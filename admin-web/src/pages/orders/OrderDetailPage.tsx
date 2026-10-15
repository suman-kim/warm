import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ordersApi } from "../../api/admin";
import { errorMessage } from "../../api/client";
import type { AdminOrderDetail, LoadingHelp } from "../../api/types";
import { Chip } from "../../ui/chip";
import {
  dateTime,
  phone,
  plate,
  shortDateTime,
  time,
  vehicleLabel,
  won,
} from "../../ui/format";
import { BackIcon } from "../../ui/icons";
import { TableNote } from "../../ui/kit";
import { useToast } from "../../ui/toast";
import { RefundModal } from "./RefundModal";

const HELP_LABEL: Record<LoadingHelp, string> = {
  NONE: "없음",
  TOGETHER: "함께",
  DRIVER_ONLY: "기사 혼자",
};

/** 동이 있으면 동, 없으면 주소의 앞 두 마디. */
function area(place: { address: string; dong: string | null }): string {
  return place.dong ?? place.address.split(/\s+/).slice(0, 2).join(" ");
}

function stairsLabel(order: AdminOrderDetail): string {
  return [
    !order.pickupAccess.elevator && order.pickupAccess.floor > 1
      ? `출발 ${order.pickupAccess.floor}층`
      : null,
    !order.dropoffAccess.elevator && order.dropoffAccess.floor > 1
      ? `도착 ${order.dropoffAccess.floor}층`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 요금 내역: 기본 요금, 운반 도움, 계단, 추가 요금, 대기료, 취소 수수료. */
function feeLines(order: AdminOrderDetail): [string, string][] {
  const items = order.extraItems;
  const extras = [
    items.overload > 0 ? `과적 ${items.overload}단계` : null,
    items.bulky > 0 ? `큰 짐 운반 ${items.bulky}개` : null,
    items.stairs > 0 ? `계단 ${items.stairs}층` : null,
  ].filter(Boolean);
  return [
    [`기본 요금 · ${vehicleLabel(order.vehicleType)}`, won(order.baseFare)],
    ...(order.helpFee > 0
      ? [
          [
            `운반 도움 · ${HELP_LABEL[order.loadingHelp]}`,
            `+${won(order.helpFee)}`,
          ] as [string, string],
        ]
      : []),
    ...(order.stairFee > 0
      ? [
          [`계단 · ${stairsLabel(order)}`, `+${won(order.stairFee)}`] as [
            string,
            string,
          ],
        ]
      : []),
    ...(order.extraFee > 0
      ? [
          [`추가 · ${extras.join(" · ")}`, `+${won(order.extraFee)}`] as [
            string,
            string,
          ],
        ]
      : []),
    ...(order.waitingFee > 0
      ? [
          [
            `대기료 · ${order.waitingMinutes}분 대기`,
            `+${won(order.waitingFee)}`,
          ] as [string, string],
        ]
      : []),
    ...(order.status === "CANCELLED" && order.payment.paidAmount > 0
      ? [
          [
            `취소 수수료 · ${order.cancellationFee > 0 ? `${Math.round((order.cancellationFee * 100) / order.fare)}%` : "0%"}`,
            won(order.cancellationFee),
          ] as [string, string],
        ]
      : []),
    ...(order.status === "NO_SHOW"
      ? [["노쇼 · 요금 100%", "환불 없음"] as [string, string]]
      : []),
  ];
}

/** 결제·환불 이력: 결제, 추가 결제, 결제 실패, 환불(자동·운영자). 일어난 순서. */
function events(order: AdminOrderDetail) {
  const payment = order.payment;
  const list: {
    at: string | null;
    label: string;
    detail: string;
    amount: string;
    tone: "ink" | "danger" | "refund" | "muted";
  }[] = [];
  if (payment.charges.length === 0) {
    list.push(
      order.status === "CANCELLED"
        ? {
            at: order.cancelledAt,
            label: "결제 없음",
            detail: "배차 전에 고객이 취소했어요",
            amount: "",
            tone: "muted",
          }
        : {
            at: order.requestedAt,
            label: "결제 대기",
            detail: payment.card
              ? `배차되면 ${payment.card.brand} ••${payment.card.last4}로 결제돼요`
              : "배차되면 결제돼요",
            amount: "",
            tone: "muted",
          },
    );
  }
  for (const charge of payment.charges) {
    const card = `${charge.card.brand} ••${charge.card.last4}`;
    if (charge.status === "FAILED") {
      list.push({
        at: charge.failedAt,
        label: charge.kind === "DISPATCH" ? "결제 실패" : "추가 결제 실패",
        detail: `${card} · ${charge.failure?.title ?? "결제 실패"}`,
        amount: won(charge.amount),
        tone: "danger",
      });
    } else {
      list.push({
        at: charge.approvedAt,
        label: charge.kind === "DISPATCH" ? "결제" : "추가 결제",
        detail: `${card} · 승인 ${charge.approvalNumber ?? "—"}`,
        amount: `+${won(charge.amount)}`,
        tone: "ink",
      });
    }
  }
  for (const refund of payment.refunds) {
    list.push({
      at: refund.refundedAt,
      label: refund.automatic ? "자동 환불" : "환불",
      detail: `${refund.reason} · ${refund.automatic ? "시스템" : (refund.refundedByName ?? "운영자")}`,
      amount: `−${won(refund.amount)}`,
      tone: "refund",
    });
  }
  return list.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
}

/** 진행 시각: 요청 → 배차 → 출발 → 도착 → 픽업 → 완료 (취소·노쇼면 그 단계로 끝난다). */
function steps(order: AdminOrderDetail) {
  const wait =
    order.arrivedAt && order.pickedUpAt
      ? order.waitingMinutes > 0
        ? `대기 ${order.waitingMinutes}분${order.waitingFee > 0 ? ` · 대기료 ${won(order.waitingFee)}` : " · 무료"}`
        : ""
      : "";
  const base: { label: string; at: string | null; sub?: string }[] = [
    { label: "요청", at: order.requestedAt },
    { label: "배차", at: order.assignedAt },
    { label: "출발", at: order.departedAt },
    { label: "도착", at: order.arrivedAt, sub: wait },
    { label: "픽업", at: order.pickedUpAt },
    { label: "완료", at: order.deliveredAt },
  ];
  if (order.status === "CANCELLED" || order.status === "PAYMENT_FAILED") {
    const reason =
      order.status === "PAYMENT_FAILED"
        ? `결제 실패로 배차되지 않음 · ${order.paymentFailure?.title ?? ""}`
        : order.payment.paidAmount === 0
          ? "배차 전 고객 취소"
          : order.cancellationFee > 0
            ? "고객 취소 · 기사 출발 후 · 수수료 15%"
            : "고객 취소 · 기사 출발 전 · 수수료 0%";
    return [
      ...base.filter((step) => step.at),
      {
        label: order.status === "CANCELLED" ? "취소" : "결제 실패",
        at: order.cancelledAt ?? order.requestedAt,
        sub: reason,
        last: true,
      },
    ];
  }
  if (order.status === "NO_SHOW") {
    return [
      ...base.filter((step) => step.at),
      {
        label: "노쇼 처리",
        at: order.noShowAt,
        sub: "기사 도착 후 30분 대기 · 요금 100%",
        last: true,
      },
    ];
  }
  return base;
}

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [refunding, setRefunding] = useState(false);
  const detail = useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => ordersApi.detail(id),
  });
  const refund = useMutation({
    mutationFn: (input: { amount: number; reason: string }) =>
      ordersApi.refund(id, input.amount, input.reason),
    onSuccess: (order, input) => {
      queryClient.setQueryData(["orders", "detail", id], order);
      void queryClient.invalidateQueries({ queryKey: ["orders", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["orders", "summary"] });
      setRefunding(false);
      toast(`${won(input.amount)} 환불했어요. 고객에게 알림을 보냈어요`);
    },
  });

  const back = (
    <Link
      to="/orders"
      className="-ml-1 flex h-8 items-center gap-1 self-start text-[14px] font-bold text-sub"
    >
      <BackIcon />
      주문 현황
    </Link>
  );
  const order = detail.data;
  if (!order) {
    return (
      <>
        {back}
        <div className="rounded-[20px] bg-white">
          <TableNote
            onRetry={detail.isError ? () => detail.refetch() : undefined}
          >
            {detail.isError ? errorMessage(detail.error) : "불러오는 중이에요"}
          </TableNote>
        </div>
      </>
    );
  }
  const payment = order.payment;
  const paid = payment.paidAmount > 0;
  const card = payment.card
    ? `${payment.card.brand} ••${payment.card.last4}`
    : "—";
  const noRefundText =
    payment.status === "UNPAID"
      ? "결제 전이라 환불할 금액이 없어요"
      : payment.status === "FAILED"
        ? "결제가 안 돼 환불할 금액이 없어요"
        : "결제 금액을 모두 환불했어요";
  const info: [string, string][] = [
    [
      "고객",
      [
        order.customer.name ?? "탈퇴한 회원",
        order.customer.phone && phone(order.customer.phone),
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    [
      "기사",
      order.driver
        ? `${order.driver.name} · ${plate(order.driver.vehicleNumber)} · ${phone(order.driver.phone)}`
        : "—",
    ],
    [
      "차종 · 거리",
      `${vehicleLabel(order.vehicleType)} · ${Math.round(order.distanceKm)}km`,
    ],
    ["운반 도움", HELP_LABEL[order.loadingHelp]],
    ["층수", stairsLabel(order) || "엘리베이터 있음"],
    ["결제 카드", card],
  ];

  return (
    <>
      {back}
      <div className="-mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[13px] font-bold text-sub">
            {order.code}
          </span>
          <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.03em]">
            {area(order.pickup)} → {area(order.dropoff)}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Chip kind={`ORDER_${order.status}`} />
            <Chip kind={`PAY_${payment.status}`} />
            <span className="text-[14px] font-semibold text-muted">
              {dateTime(order.requestedAt)} 요청 ·{" "}
              {vehicleLabel(order.vehicleType)} · {Math.round(order.distanceKm)}
              km
            </span>
          </div>
        </div>
        {payment.refundableAmount > 0 ? (
          <button
            type="button"
            onClick={() => setRefunding(true)}
            className="h-[46px] rounded-[14px] bg-ink px-[22px] text-[15px] font-extrabold text-white"
          >
            환불 처리
          </button>
        ) : (
          <span className="text-[13px] font-bold text-muted">
            {noRefundText}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-[20px] bg-white px-[22px] py-5">
            <h2 className="m-0 text-[16px] font-extrabold">요금 내역</h2>
            <div className="flex flex-col">
              {feeLines(order).map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-rule py-2.5 text-[14px]"
                >
                  <span className="font-semibold text-sub">{label}</span>
                  <span className="tnum font-bold">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1 rounded-[14px] bg-well px-4 py-3 text-[14px]">
              {paid ? (
                <>
                  <div className="flex justify-between py-1">
                    <span className="font-semibold text-sub">결제 금액</span>
                    <span className="tnum font-bold">
                      {won(payment.paidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-semibold text-sub">환불</span>
                    <span className="tnum font-bold">
                      {payment.refundedAmount
                        ? `−${won(payment.refundedAmount)}`
                        : "0원"}
                    </span>
                  </div>
                  {payment.unpaidAmount > 0 && (
                    <div className="flex justify-between py-1">
                      <span className="font-semibold text-danger">
                        결제 안 된 추가 요금
                      </span>
                      <span className="tnum font-bold text-danger">
                        {won(payment.unpaidAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <span className="font-extrabold">최종 결제 금액</span>
                    <span className="tnum font-extrabold">
                      {won(payment.paidAmount - payment.refundedAmount)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between py-1">
                  <span className="font-extrabold">결제</span>
                  <span className="font-bold">
                    {payment.status === "FAILED"
                      ? "결제 실패 · 0원"
                      : order.status === "CANCELLED"
                        ? "결제되지 않음"
                        : "배차되면 결제돼요"}
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-1 rounded-[20px] bg-white px-[22px] py-5">
            <h2 className="m-0 mb-2 text-[16px] font-extrabold">
              결제·환불 이력
            </h2>
            {events(order).map((event, index) => (
              <div
                key={index}
                className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-start gap-3 border-t border-rule py-3 first:border-t-0 text-[14px]"
              >
                <span className="tnum font-semibold text-muted">
                  {event.at ? shortDateTime(event.at) : "—"}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span
                    className={`font-extrabold ${
                      event.tone === "danger"
                        ? "text-danger"
                        : event.tone === "muted"
                          ? "text-sub"
                          : ""
                    }`}
                  >
                    {event.label}
                  </span>
                  <span className="text-[13px] font-semibold text-sub">
                    {event.detail}
                  </span>
                </span>
                <span
                  className={`tnum font-extrabold ${
                    event.tone === "refund" ? "text-ok" : ""
                  }`}
                >
                  {event.amount}
                </span>
              </div>
            ))}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col rounded-[20px] bg-white px-[22px] py-5">
            <h2 className="m-0 mb-3 text-[16px] font-extrabold">진행 시각</h2>
            {steps(order).map((step, index, all) => {
              const done = !!step.at;
              const last = "last" in step && step.last;
              return (
                <div key={step.label} className="flex gap-3">
                  <div className="flex w-3 flex-col items-center">
                    <span
                      className={`mt-[5px] size-3 flex-none rounded-full ${
                        done
                          ? last
                            ? "bg-danger"
                            : "bg-ink"
                          : "bg-white shadow-[inset_0_0_0_2px_#D4D2CB]"
                      }`}
                    />
                    {index < all.length - 1 && (
                      <span className="w-px flex-1 bg-box" />
                    )}
                  </div>
                  <div className="flex flex-1 items-start justify-between pb-4 text-[14px]">
                    <span className="flex flex-col gap-0.5">
                      <span
                        className={`font-extrabold ${done ? "" : "text-faint"}`}
                      >
                        {step.label}
                      </span>
                      {step.sub && (
                        <span className="text-[12px] font-semibold text-muted">
                          {step.sub}
                        </span>
                      )}
                    </span>
                    <span
                      className={`tnum font-bold ${done ? "" : "text-faint"}`}
                    >
                      {step.at ? time(step.at) : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="flex flex-col rounded-[20px] bg-white px-[22px] py-5">
            <h2 className="m-0 mb-2 text-[16px] font-extrabold">주문 정보</h2>
            {info.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-t border-rule py-2.5 first:border-t-0 text-[14px]"
              >
                <span className="flex-none font-semibold text-sub">
                  {label}
                </span>
                <span className="text-right font-bold">{value}</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      {refunding && (
        <RefundModal
          order={order}
          busy={refund.isPending}
          error={refund.error ? errorMessage(refund.error) : null}
          onSubmit={(amount, reason) => refund.mutate({ amount, reason })}
          onClose={() => {
            refund.reset();
            setRefunding(false);
          }}
        />
      )}
    </>
  );
}
