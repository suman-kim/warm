import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ordersApi } from "../api/store";
import type { Order, OrderStatus } from "../api/types";
import { TopBar } from "../layout/Shell";
import {
  addDays,
  monthDayTime,
  PAYMENTS,
  roadOnly,
  statusChip,
  todayKst,
  won,
} from "../ui/format";
import { DownloadIcon } from "../ui/icons";
import { StatusChip, Tabs } from "../ui/kit";

type Period = "today" | "yesterday" | "week" | "month";
type Filter = "ALL" | "DELIVERED" | "CANCELLED";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "week", label: "최근 7일" },
  { key: "month", label: "최근 30일" },
];

function rangeOf(period: Period): [string, string] {
  const today = todayKst();
  switch (period) {
    case "today":
      return [today, today];
    case "yesterday":
      return [addDays(today, -1), addDays(today, -1)];
    case "week":
      return [addDays(today, -6), today];
    case "month":
      return [addDays(today, -29), today];
  }
}

/** 기간의 배달을 모두 받는다 (한 번에 100건씩). */
async function fetchAll(
  from: string,
  to: string,
  status?: OrderStatus,
): Promise<Order[]> {
  const all: Order[] = [];
  for (let page = 1; page <= 20; page++) {
    const result = await ordersApi.list({ from, to, status, page, size: 100 });
    all.push(...result.items);
    if (all.length >= result.total || result.items.length === 0) break;
  }
  return all;
}

/** 이 배달로 충전금에서 나간 돈: 취소면 수수료, 아니면 대행료. */
const charged = (order: Order) =>
  order.status === "CANCELLED" ? order.cancellationFee : order.fare;

/** 배달 내역. 기간과 완료·취소로 거르고, 엑셀(CSV)로 내려받는다. */
export function HistoryPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [range, setRange] = useState<[string, string]>(() => rangeOf("week"));
  const [filter, setFilter] = useState<Filter>("ALL");
  const [from, to] = range;
  const history = useQuery({
    queryKey: ["orders", "history", from, to, filter],
    queryFn: () => fetchAll(from, to, filter === "ALL" ? undefined : filter),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const rows = history.data ?? [];
  const fees = rows.reduce((sum, order) => sum + charged(order), 0);
  const collected = rows.reduce(
    (sum, order) => sum + (order.storeDelivery?.collectedAmount ?? 0),
    0,
  );

  const download = () => {
    const header = [
      "요청 시각",
      "주문번호",
      "손님 주소",
      "상태",
      "결제 방식",
      "음식값",
      "대행료",
      "라이더",
    ];
    const lines = rows.map((order) => [
      monthDayTime(order.requestedAt),
      order.code,
      [order.dropoff.address, order.dropoff.detailAddress]
        .filter(Boolean)
        .join(" "),
      statusChip(order.status).label,
      order.storeDelivery ? PAYMENTS[order.storeDelivery.doorPayment] : "",
      String(order.storeDelivery?.foodAmount ?? 0),
      String(charged(order)),
      order.driverName ?? "",
    ]);
    const csv = [header, ...lines]
      .map((line) =>
        line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    // 엑셀이 한글을 깨뜨리지 않게 BOM을 붙인다.
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `MOVO-배달내역-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <>
      <TopBar
        title="배달 내역"
        updatedAt={history.dataUpdatedAt}
        onRefresh={() => history.refetch()}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            label="기간"
            value={period}
            onChange={(next) => {
              setPeriod(next);
              setRange(rangeOf(next));
            }}
            items={PERIODS}
          />
          <div className="flex h-11 items-center gap-2 rounded-[14px] bg-white px-3 shadow-[inset_0_0_0_1px_#E6E4DE]">
            <input
              type="date"
              aria-label="시작 날짜"
              value={from}
              max={to}
              onChange={(event) =>
                event.target.value && setRange([event.target.value, to])
              }
              className="tnum bg-transparent text-[13px] font-bold outline-none"
            />
            <span className="text-faint">–</span>
            <input
              type="date"
              aria-label="끝 날짜"
              value={to}
              min={from}
              max={todayKst()}
              onChange={(event) =>
                event.target.value && setRange([from, event.target.value])
              }
              className="tnum bg-transparent text-[13px] font-bold outline-none"
            />
          </div>
          <Tabs
            label="상태"
            value={filter}
            onChange={setFilter}
            items={[
              { key: "ALL", label: "전체" },
              { key: "DELIVERED", label: "완료" },
              { key: "CANCELLED", label: "취소" },
            ]}
          />
          <button
            type="button"
            onClick={download}
            disabled={rows.length === 0}
            className="ml-auto flex h-10 items-center gap-1.5 rounded-[12px] bg-white px-3.5 text-[13px] font-extrabold shadow-[inset_0_0_0_1px_#E6E4DE] disabled:opacity-40"
          >
            <DownloadIcon />
            엑셀로 내려받기
          </button>
        </div>
        <span className="text-[13px] font-bold text-sub">
          {rows.length}건 · 대행료 {won(fees)} · 만나서 받은 음식값{" "}
          {won(collected)}
        </span>
        <div className="overflow-x-auto rounded-[20px] bg-white">
          <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-rule text-[12px] font-bold text-muted">
                {[
                  "요청 시각",
                  "주문번호",
                  "손님 주소",
                  "상태",
                  "결제 방식",
                  "음식값",
                  "대행료",
                  "라이더",
                ].map((label) => (
                  <th key={label} className="px-4 py-3 font-bold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-rule last:border-b-0"
                >
                  <td className="tnum px-4 py-3 font-semibold whitespace-nowrap">
                    {monthDayTime(order.requestedAt)}
                  </td>
                  <td className="tnum px-4 py-3 font-mono text-[12px] font-bold whitespace-nowrap">
                    {order.code}
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 font-semibold">
                    {[
                      order.dropoff.dong,
                      [
                        roadOnly(order.dropoff.address),
                        order.dropoff.detailAddress,
                      ]
                        .filter(Boolean)
                        .join(" "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={order.status} />
                  </td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    {order.storeDelivery
                      ? PAYMENTS[order.storeDelivery.doorPayment]
                      : ""}
                  </td>
                  <td className="tnum px-4 py-3 font-semibold whitespace-nowrap">
                    {won(order.storeDelivery?.foodAmount ?? 0)}
                  </td>
                  <td className="tnum px-4 py-3 font-extrabold whitespace-nowrap">
                    {order.status === "CANCELLED" && order.cancellationFee > 0
                      ? `수수료 ${won(order.cancellationFee)}`
                      : won(charged(order))}
                  </td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    {order.driverName ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="px-4 py-10 text-center text-[14px] font-semibold text-muted">
              {history.isPending
                ? "불러오는 중이에요"
                : "이 기간에 배달 내역이 없어요"}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
