import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "../../api/client";
import { ordersApi } from "../../api/store";
import type { OrderDetail } from "../../api/types";
import {
  ampm,
  clock,
  isActive,
  PAYMENTS,
  phone,
  plate,
  shortCode,
  won,
} from "../../ui/format";
import { BikeIcon, CloseIcon, PhoneIcon, StoreSmallIcon } from "../../ui/icons";
import { KeyValue, Modal, ModalHeader, StatusChip } from "../../ui/kit";
import { useToast } from "../../ui/toast";

const REASONS = [
  "손님이 주문을 취소했어요",
  "음식을 준비할 수 없어요",
  "주소를 잘못 넣었어요",
  "직접 입력",
];

/** 배달 상세 (보드 오른쪽). 진행 단계, 라이더, 예정 시각, 손님 정보, [배달 취소]. */
export function DeliveryPanel({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const detail = useQuery({
    queryKey: ["orders", "detail", orderId],
    queryFn: () => ordersApi.get(orderId),
    refetchInterval: (query) =>
      query.state.data && isActive(query.state.data.status) ? 5_000 : false,
  });
  const order = detail.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3">
        <span className="flex items-baseline gap-2">
          <span className="text-[16px] font-extrabold">배달 상세</span>
          {order && (
            <span className="tnum font-mono text-[12px] font-bold text-muted">
              {order.code}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex size-8 items-center justify-center rounded-lg bg-hair"
        >
          <CloseIcon />
        </button>
      </div>
      {!order ? (
        <span className="px-5 py-8 text-[14px] font-semibold text-muted">
          {detail.isError ? errorMessage(detail.error) : "불러오는 중이에요"}
        </span>
      ) : (
        <>
          <Body order={order} />
          {order.cancellationFeeNow !== null && (
            <div className="border-t border-line px-5 pt-3 pb-5">
              <button
                type="button"
                onClick={() => setCancelling(true)}
                className="h-12 w-full rounded-2xl bg-danger-soft text-[14px] font-extrabold text-danger"
              >
                배달 취소 ·{" "}
                {order.cancellationFeeNow > 0
                  ? `지금 취소하면 수수료 ${won(order.cancellationFeeNow)}`
                  : "대행료를 모두 돌려받아요"}
              </button>
            </div>
          )}
          {order.status === "PICKED_UP" && (
            <span className="border-t border-line px-5 py-4 text-center text-[13px] font-bold text-muted">
              픽업 이후에는 취소할 수 없어요.
            </span>
          )}
          {cancelling && (
            <CancelModal
              order={order}
              onClose={() => setCancelling(false)}
              onDone={() => {
                setCancelling(false);
                onChanged();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function headline(order: OrderDetail): [string, string] {
  const eta = order.estimatedPickupAt;
  switch (order.status) {
    case "REQUESTED":
      return ["라이더를 찾고 있어요", "주변 라이더에게 알렸어요"];
    case "ASSIGNED":
    case "DEPARTED":
      return [
        "라이더가 가게로 오고 있어요",
        [
          order.assignedAt && `라이더 배정 ${ampm(order.assignedAt)}`,
          eta && `픽업 예정 ${ampm(eta)}`,
        ]
          .filter(Boolean)
          .join(" · "),
      ];
    case "ARRIVED":
      return [
        "라이더가 가게에 도착했어요",
        `주문번호 끝자리 ${shortCode(order)}로 음식을 전해 주세요`,
      ];
    case "PICKED_UP":
      return [
        "손님에게 배달하고 있어요",
        order.estimatedDeliveryAt
          ? `도착 예정 ${ampm(order.estimatedDeliveryAt)}`
          : "",
      ];
    case "DELIVERED":
      return [
        "배달을 마쳤어요",
        order.deliveredAt
          ? `${ampm(order.deliveredAt)}에 손님에게 전했어요`
          : "",
      ];
    default:
      return [
        "취소한 배달이에요",
        order.cancelledAt ? `${ampm(order.cancelledAt)}에 취소했어요` : "",
      ];
  }
}

function Body({ order }: { order: OrderDetail }) {
  const [title, sub] = headline(order);
  const delivery = order.storeDelivery;
  const live = isActive(order.status);
  const steps: [string, string | null][] = [
    ["요청", order.requestedAt],
    ["배정", order.assignedAt],
    ["가게 도착", order.arrivedAt],
    ["픽업", order.pickedUpAt],
    ["완료", order.deliveredAt],
  ];
  const last = steps.reduce((at, [, time], index) => (time ? index : at), -1);
  const cancelled = order.status === "CANCELLED";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4">
      <div className="flex flex-col gap-1.5">
        <span className="self-start">
          <StatusChip status={order.status} />
        </span>
        <span className="text-[19px] font-extrabold tracking-[-0.02em]">
          {title}
        </span>
        {sub && (
          <span className="text-[12px] font-semibold text-muted">{sub}</span>
        )}
      </div>
      {!cancelled && (
        <ol className="relative m-0 grid list-none grid-cols-5 p-0 pt-1">
          <span className="absolute top-[11px] right-[10%] left-[10%] h-0.5 bg-line" />
          <span
            className="absolute top-[11px] left-[10%] h-0.5 bg-ink"
            style={{ width: `${Math.max(0, last) * 20}%` }}
          />
          {steps.map(([label, time], index) => (
            <li
              key={label}
              className="relative flex flex-col items-center gap-1"
            >
              <span
                className={`size-3.5 rounded-full ${
                  time
                    ? index === last && live
                      ? "bg-lime ring-[3px] ring-ink"
                      : "bg-ink"
                    : "bg-white ring-2 ring-box"
                }`}
              />
              <span
                className={`text-[11px] font-extrabold ${time ? "" : "text-faint"}`}
              >
                {label}
              </span>
              <span className="tnum text-[10px] font-semibold text-muted">
                {time ? clock(time) : " "}
              </span>
            </li>
          ))}
        </ol>
      )}
      {order.driver && !cancelled && (
        <div className="flex items-center gap-3 rounded-[16px] bg-hair p-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-ink text-lime">
            <BikeIcon />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] font-extrabold">
              {order.driver.name} 라이더
            </span>
            <span className="text-[12px] font-semibold text-muted">
              {plate(order.driver.vehicleNumber)} · 오토바이
            </span>
          </span>
          <a
            href={`tel:${order.driver.phone}`}
            className="flex h-9 items-center gap-1.5 rounded-[12px] bg-lime px-3 text-[13px] font-extrabold text-ink"
          >
            <PhoneIcon />
            전화
          </a>
        </div>
      )}
      {live && order.status !== "REQUESTED" && (
        <div className="grid grid-cols-2 gap-2">
          <TimeBox
            label={order.pickedUpAt ? "픽업" : "픽업 예정"}
            at={order.pickedUpAt ?? order.estimatedPickupAt}
          />
          <TimeBox label="도착 예정" at={order.estimatedDeliveryAt} />
        </div>
      )}
      {order.status === "DELIVERED" && delivery && (
        <div className="flex flex-col gap-1 rounded-[16px] bg-ink p-3.5 text-white">
          <span className="text-[11px] font-bold text-nav">받은 방식·금액</span>
          <span className="text-[16px] font-extrabold text-lime">
            {delivery.collectedMethod
              ? `${delivery.collectedMethod === "CARD" ? "카드" : "현금"} ${won(delivery.collectedAmount ?? 0)} 받았어요`
              : "선결제 주문 · 받은 돈 없음"}
          </span>
          {delivery.collectedAmount !== null &&
            delivery.collectedAmount !== delivery.foodAmount && (
              <span className="text-[12px] font-bold text-[#FF7B6B]">
                음식값 {won(delivery.foodAmount)}과 달라요
              </span>
            )}
        </div>
      )}
      {cancelled && (
        <div className="flex flex-col rounded-[16px] bg-hair px-3.5 py-1">
          {order.cancelledAt && (
            <KeyValue label="취소 시각" value={ampm(order.cancelledAt)} />
          )}
          {order.cancelReason && (
            <KeyValue label="취소 사유" value={order.cancelReason} />
          )}
          <KeyValue label="취소 수수료" value={won(order.cancellationFee)} />
          <KeyValue
            label="돌려받은 대행료"
            value={won(order.fare - order.cancellationFee)}
            strong
          />
        </div>
      )}
      <div className="flex flex-col">
        <KeyValue label="주소" value={order.dropoff.address} />
        <KeyValue
          label="상세주소"
          value={order.dropoff.detailAddress || "없음"}
        />
        <KeyValue label="연락처" value={phone(order.dropoff.contactPhone)} />
        {delivery && (
          <KeyValue
            label="음식값"
            value={`${won(delivery.foodAmount)} · ${PAYMENTS[delivery.doorPayment]}`}
          />
        )}
        <KeyValue label="요청사항" value={order.memo || "없음"} />
        <KeyValue
          label="배달대행료"
          value={`${won(order.fare)} · 충전금에서 빠짐`}
        />
      </div>
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
        <StoreSmallIcon />
        라이더에게 주문번호 끝자리 {shortCode(order)}를 확인해 음식을 전해
        주세요
      </span>
    </div>
  );
}

function TimeBox({ label, at }: { label: string; at: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[14px] bg-hair px-3.5 py-2.5">
      <span className="text-[11px] font-bold text-muted">{label}</span>
      <span className="tnum text-[16px] font-extrabold">
        {at ? ampm(at) : "어림하는 중"}
      </span>
    </div>
  );
}

function CancelModal({
  order,
  onClose,
  onDone,
}: {
  order: OrderDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pick, setPick] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const fee = order.cancellationFeeNow ?? 0;
  const percent = order.fare ? Math.round((fee * 100) / order.fare) : 0;
  const cancel = useMutation({
    mutationFn: (reason: string) => ordersApi.cancel(order.id, reason),
    onSuccess: (cancelled) => {
      toast(
        `배달을 취소했어요 · ${won(cancelled.fare - cancelled.cancellationFee)}을 충전금으로 돌려받았어요`,
      );
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["store"] });
      onDone();
    },
  });
  const submit = () => {
    const reason = pick === "직접 입력" ? text.trim() : pick;
    if (!reason) {
      setInvalid("취소 사유를 골라 주세요.");
      return;
    }
    cancel.mutate(reason);
  };
  return (
    <Modal label="배달 취소" width={460} onClose={onClose}>
      <ModalHeader
        title="배달을 취소할까요?"
        sub={
          fee > 0
            ? `${order.status === "ARRIVED" ? "라이더가 이미 가게에 와서" : "라이더가 이미 출발해서"} 대행료의 ${percent}%를 빼고 돌려드려요.`
            : "라이더가 출발하기 전이라 대행료를 모두 돌려드려요."
        }
        onClose={onClose}
      />
      <div className="flex flex-wrap gap-2">
        {REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            aria-pressed={pick === reason}
            onClick={() => {
              setPick(reason);
              setInvalid(null);
            }}
            className={`h-9 rounded-[11px] px-3 text-[13px] font-extrabold ${
              pick === reason
                ? "bg-ink text-white"
                : "bg-white shadow-[inset_0_0_0_1.5px_#E6E4DE]"
            }`}
          >
            {reason}
          </button>
        ))}
      </div>
      {pick === "직접 입력" && (
        <textarea
          value={text}
          maxLength={100}
          rows={2}
          autoFocus
          onChange={(event) => {
            setText(event.target.value);
            setInvalid(null);
          }}
          placeholder="취소 사유를 적어 주세요"
          className="resize-none rounded-[14px] p-3 text-[14px] font-semibold shadow-[inset_0_0_0_1.5px_#E6E4DE] outline-none"
        />
      )}
      <div className="flex flex-col rounded-[16px] bg-paper px-4 py-1">
        <KeyValue label="대행료" value={won(order.fare)} />
        <KeyValue
          label={fee > 0 ? `취소 수수료 · ${percent}%` : "취소 수수료"}
          value={fee > 0 ? `−${won(fee)}` : "0원"}
        />
        <KeyValue label="돌려받을 금액" value={won(order.fare - fee)} strong />
      </div>
      {(invalid || cancel.isError) && (
        <span role="alert" className="text-[13px] font-bold text-danger">
          {invalid ?? errorMessage(cancel.error)}
        </span>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-12 flex-1 rounded-[14px] bg-hair text-[15px] font-extrabold"
        >
          돌아가기
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={cancel.isPending}
          className="h-12 flex-[1.4] rounded-[14px] bg-danger text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          배달 취소하기
        </button>
      </div>
    </Modal>
  );
}
