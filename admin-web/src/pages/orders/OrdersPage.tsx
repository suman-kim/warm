import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ordersApi } from "../../api/admin";
import type { OrderStatus, PaymentFilter } from "../../api/types";
import { Chip } from "../../ui/chip";
import {
  addDays,
  dotted,
  time,
  todayKst,
  vehicleLabel,
  weekday,
  won,
} from "../../ui/format";
import { nextPage } from "../../ui/hooks";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../../ui/icons";
import {
  ListState,
  LoadMore,
  PageTitle,
  TableCard,
  TableHead,
  TableRow,
} from "../../ui/kit";

const COLUMNS = "136px 54px 84px minmax(170px,1fr) 66px 66px 90px 104px 96px";

type Filter =
  | "ALL"
  | "SEARCHING"
  | "ASSIGNED"
  | "DELIVERING"
  | "DONE"
  | "CANCELLED"
  | "NO_SHOW";

/** 상태 타일. 점의 모양은 디자인의 값이다. 한 타일이 여러 상태를 묶는다. */
const TILES: {
  key: Filter;
  label: string;
  statuses?: OrderStatus[];
  dot: string;
  dotOn?: string;
}[] = [
  {
    key: "ALL",
    label: "전체",
    dot: "ring-ink",
    dotOn: "shadow-[inset_0_0_0_1.5px_#fff]",
  },
  {
    key: "SEARCHING",
    label: "기사 찾는 중",
    statuses: ["REQUESTED", "PAYING"],
    dot: "bg-lime ring-ink",
  },
  {
    key: "ASSIGNED",
    label: "배차 완료",
    statuses: ["ASSIGNED"],
    dot: "bg-ink",
    dotOn: "bg-white",
  },
  {
    key: "DELIVERING",
    label: "배송 중",
    statuses: ["DEPARTED", "ARRIVED", "PICKED_UP"],
    dot: "bg-ink",
    dotOn: "bg-lime",
  },
  { key: "DONE", label: "완료", statuses: ["DELIVERED"], dot: "bg-ok-dot" },
  {
    key: "CANCELLED",
    label: "취소",
    statuses: ["CANCELLED", "PAYMENT_FAILED"],
    dot: "bg-danger",
  },
  { key: "NO_SHOW", label: "노쇼", statuses: ["NO_SHOW"], dot: "bg-danger" },
];

/** 결제 탭. */
const PAYMENT_TABS: { key: PaymentFilter | "ALL"; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "UNPAID", label: "결제 전" },
  { key: "PAID", label: "결제 완료" },
  { key: "FAILED", label: "결제 실패" },
  { key: "REFUND", label: "환불" },
];

export function OrdersPage() {
  const today = todayKst();
  const navigate = useNavigate();
  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [payment, setPayment] = useState<PaymentFilter | "ALL">("ALL");
  const statuses = TILES.find((tile) => tile.key === filter)!.statuses;
  const paymentFilter = payment === "ALL" ? undefined : payment;
  const summary = useQuery({
    queryKey: ["orders", "summary", day],
    queryFn: () => ordersApi.summary(day),
    placeholderData: keepPreviousData,
    // 오늘은 주문이 계속 들어온다.
    refetchInterval: day === today ? 30_000 : false,
  });
  const list = useInfiniteQuery({
    queryKey: ["orders", "list", day, filter, payment],
    queryFn: ({ pageParam }) =>
      ordersApi.list(day, statuses, paymentFilter, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    placeholderData: keepPreviousData,
    refetchInterval: day === today ? 30_000 : false,
  });
  const rows = list.data?.pages.flatMap((page) => page.items) ?? [];
  const total = list.data?.pages[0].total ?? 0;
  const isToday = day === today;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="주문 현황"
          sub="하루 단위로 주문을 상태별로 모아 봐요"
        />
        <div className="flex items-center gap-2">
          <div className="ring-line flex h-11 items-center rounded-[14px] bg-white">
            <button
              type="button"
              aria-label="이전 날"
              onClick={() => setDay(addDays(day, -1))}
              className="flex h-11 w-[42px] items-center justify-center"
            >
              <ChevronLeftIcon />
            </button>
            <span className="tnum flex min-w-[150px] items-center justify-center gap-2 px-1.5 text-[15px] font-extrabold">
              <CalendarIcon />
              {dotted(day)} ({weekday(day)}){isToday ? " 오늘" : ""}
            </span>
            <button
              type="button"
              aria-label="다음 날"
              disabled={isToday}
              onClick={() => setDay(addDays(day, 1))}
              className="flex h-11 w-[42px] items-center justify-center disabled:opacity-30"
            >
              <ChevronRightIcon />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDay(today)}
            className="ring-line h-11 rounded-[14px] bg-white px-4 text-[14px] font-bold"
          >
            오늘
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
        {TILES.map((tile) => {
          const on = filter === tile.key;
          const counts = summary.data?.counts;
          const count =
            tile.key === "ALL"
              ? summary.data?.total
              : counts &&
                tile.statuses!.reduce((sum, each) => sum + counts[each], 0);
          return (
            <button
              key={tile.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(tile.key)}
              className={`flex w-full flex-col gap-3 rounded-[18px] px-[18px] py-4 text-left ${
                on ? "bg-ink text-white" : "bg-white text-ink"
              }`}
            >
              <span
                className={`flex items-center gap-[7px] text-[13px] font-bold ${
                  on ? "text-dim" : "text-muted"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    on && tile.dotOn ? tile.dotOn : tile.dot
                  }`}
                />
                {tile.label}
              </span>
              <span className="tnum text-[28px] leading-none font-extrabold tracking-[-0.03em]">
                {count ?? "–"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1.5 text-[13px] font-bold text-muted">결제</span>
        {PAYMENT_TABS.map((tab) => {
          const on = payment === tab.key;
          const count =
            tab.key === "ALL"
              ? summary.data?.total
              : summary.data?.paymentCounts[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={on}
              onClick={() => setPayment(tab.key)}
              className={`flex h-9 items-center gap-1.5 rounded-[11px] px-[13px] text-[13px] font-extrabold ${
                on ? "bg-ink text-white" : "ring-line bg-white text-ink"
              }`}
            >
              {tab.label}
              {filter === "ALL" && count !== undefined && (
                <span
                  className={`tnum font-bold ${on ? "text-dim" : "text-muted"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <TableCard minWidth={1060}>
        <div className="flex items-center justify-between gap-3 px-[22px] pt-[18px] pb-1">
          <span className="text-[15px] font-extrabold">
            {TILES.find((tile) => tile.key === filter)!.label} 주문 {total}건
          </span>
          <span className="tnum text-[13px] font-bold text-muted">
            결제 {won(summary.data?.paidAmount ?? 0)} · 환불{" "}
            {won(summary.data?.refundedAmount ?? 0)}
          </span>
        </div>
        <TableHead columns={COLUMNS} height={44}>
          <span>주문번호</span>
          <span>요청</span>
          <span>차종</span>
          <span>구간</span>
          <span>고객</span>
          <span>기사</span>
          <span className="text-right">요금</span>
          <span>주문</span>
          <span>결제</span>
        </TableHead>
        {rows.map((order) => (
          <TableRow
            key={order.id}
            columns={COLUMNS}
            className="h-[54px]"
            onClick={() => navigate(`/orders/${order.id}`)}
          >
            <span className="font-mono text-[12px] font-semibold text-sub">
              {order.code}
            </span>
            <span className="tnum">{time(order.requestedAt)}</span>
            <span className="font-bold">{vehicleLabel(order.vehicleType)}</span>
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate">
                {order.pickupArea} → {order.dropoffArea}
              </span>
              <span className="flex-none text-[12px] text-muted">
                {Math.round(order.distanceKm)}km
              </span>
            </span>
            <span className="truncate">{order.customerName ?? "—"}</span>
            <span
              className={`truncate ${order.driverName ? "" : "text-faint"}`}
            >
              {order.driverName ?? "—"}
            </span>
            <span className="tnum text-right font-bold">
              {won(order.totalFare)}
            </span>
            <div>
              <Chip kind={`ORDER_${order.status}`} />
            </div>
            <div>
              <Chip kind={`PAY_${order.paymentStatus}`} />
            </div>
          </TableRow>
        ))}
        <ListState
          loading={list.isPending}
          error={list.isError}
          empty={rows.length === 0}
          emptyText={
            filter === "ALL" && payment === "ALL"
              ? "이날 들어온 주문이 없어요"
              : "이 상태의 주문이 없어요"
          }
          onRetry={() => list.refetch()}
        />
      </TableCard>
      <LoadMore
        shown={rows.length}
        total={total}
        loading={list.isFetchingNextPage}
        onMore={() => list.fetchNextPage()}
      />
    </>
  );
}
