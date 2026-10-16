import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ordersApi } from "../api/store";
import type { Order, OrderStatus } from "../api/types";
import { useStore } from "../auth/session";
import { TopBar } from "../layout/Shell";
import {
  ampm,
  clock,
  isActive,
  paymentLine,
  roadOnly,
  shortCode,
  statusChip,
  todayKst,
} from "../ui/format";
import { beep, notify } from "../ui/prefs";
import { DeliveryPanel } from "./board/DeliveryPanel";
import { QuickRequest } from "./board/QuickRequest";

/** 배차가 이보다(분) 늦으면 빨갛게 보인다. */
const DISPATCH_LATE_MINUTES = 10;

const COLUMNS: { title: string; dot: string; statuses: OrderStatus[] }[] = [
  {
    title: "라이더 찾는 중",
    dot: "ring-2 ring-ink bg-lime",
    statuses: ["REQUESTED"],
  },
  {
    title: "가게로 오는 중",
    dot: "bg-ink",
    statuses: ["ASSIGNED", "DEPARTED", "ARRIVED"],
  },
  { title: "배달 중", dot: "bg-ok-dot", statuses: ["PICKED_UP"] },
  {
    title: "완료·취소 (오늘)",
    dot: "bg-faint",
    statuses: ["DELIVERED", "CANCELLED"],
  },
];

const minutesSince = (at: string, now: number) =>
  Math.max(0, Math.floor((now - Date.parse(at)) / 60_000));

/** 배달 보드. 진행 중인 배달을 단계별로 보고, 오른쪽에서 바로 요청한다. 배달을 누르면 상세가 열린다. */
export function BoardPage() {
  const store = useStore();
  const [selected, setSelected] = useState<string | null>(null);
  const board = useQuery({
    queryKey: ["orders", "board"],
    queryFn: () => ordersApi.list({ size: 100 }),
    refetchInterval: 5_000,
  });
  const now = board.dataUpdatedAt || Date.now();
  const today = todayKst();
  const orders = (board.data?.items ?? []).filter(
    (order) =>
      isActive(order.status) || todayKst(new Date(order.requestedAt)) === today,
  );
  useStatusAlerts(orders);

  const todays = orders.filter(
    (order) => todayKst(new Date(order.requestedAt)) === today,
  );
  const active = orders.filter((order) => isActive(order.status));
  const late = active.filter(
    (order) =>
      order.status === "REQUESTED" &&
      minutesSince(order.requestedAt, now) >= DISPATCH_LATE_MINUTES,
  ).length;

  return (
    <>
      <TopBar
        title="배달 보드"
        updatedAt={board.dataUpdatedAt}
        onRefresh={() => board.refetch()}
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="오늘 요청" value={`${todays.length}건`} />
            <Stat
              label="완료"
              value={`${todays.filter((o) => o.status === "DELIVERED").length}건`}
            />
            <Stat label="진행 중" value={`${active.length}건`} />
            <Stat label="배차 10분 넘음" value={`${late}건`} alert={late > 0} />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-4 gap-3">
            {COLUMNS.map((column) => {
              const items = orders
                .filter((order) => column.statuses.includes(order.status))
                .sort(
                  (a, b) =>
                    Date.parse(a.requestedAt) - Date.parse(b.requestedAt),
                );
              return (
                <section
                  key={column.title}
                  aria-label={column.title}
                  className="flex min-h-0 flex-col gap-2 rounded-[20px] bg-well p-2.5"
                >
                  <div className="flex items-center gap-2 px-1.5 pt-1">
                    <span className={`size-2 rounded-full ${column.dot}`} />
                    <span className="flex-1 text-[13px] font-extrabold">
                      {column.title}
                    </span>
                    <span className="tnum text-[12px] font-bold text-muted">
                      {items.length}건
                    </span>
                  </div>
                  <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
                    {items.map((order) => (
                      <Card
                        key={order.id}
                        order={order}
                        now={now}
                        selected={selected === order.id}
                        onClick={() =>
                          setSelected(selected === order.id ? null : order.id)
                        }
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
        <aside className="flex w-[380px] flex-none flex-col border-l border-line bg-white">
          {selected ? (
            <DeliveryPanel
              orderId={selected}
              onClose={() => setSelected(null)}
              onChanged={() => board.refetch()}
            />
          ) : (
            store.data && (
              <QuickRequest
                store={store.data}
                onRequested={() => board.refetch()}
              />
            )
          )}
        </aside>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-[16px] bg-white px-4 py-3">
      <span className="text-[12px] font-bold text-muted">{label}</span>
      <span
        className={`tnum text-[20px] font-extrabold tracking-[-0.02em] ${alert ? "text-danger" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function Card({
  order,
  now,
  selected,
  onClick,
}: {
  order: Order;
  now: number;
  selected: boolean;
  onClick: () => void;
}) {
  const elapsed = minutesSince(order.requestedAt, now);
  const finished = !isActive(order.status);
  const chip = statusChip(order.status);
  const meta = (() => {
    switch (order.status) {
      case "PICKED_UP":
        return order.estimatedDeliveryAt
          ? `도착 ${ampm(order.estimatedDeliveryAt)}`
          : `${elapsed}분 경과`;
      case "DELIVERED":
        return order.deliveredAt ? `${clock(order.deliveredAt)} 완료` : "완료";
      case "CANCELLED":
        return order.cancelledAt ? `${clock(order.cancelledAt)} 취소` : "취소";
      default:
        return `${elapsed}분 경과`;
    }
  })();
  const lateDispatch =
    order.status === "REQUESTED" && elapsed >= DISPATCH_LATE_MINUTES;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col gap-1 rounded-[14px] bg-white p-3 text-left ${
        selected ? "shadow-[inset_0_0_0_2px_#121212]" : ""
      } ${finished ? "opacity-90" : ""}`}
    >
      {(order.status === "ARRIVED" || finished) && (
        <span
          className={`mb-1 self-start rounded-md px-1.5 py-[3px] text-[11px] font-extrabold ${chip.className}`}
        >
          {chip.label}
        </span>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[16px] font-extrabold">
          {order.dropoff.dong ?? roadOnly(order.dropoff.address)}
        </span>
        <span
          className={`tnum text-[12px] font-bold ${lateDispatch ? "text-danger" : "text-muted"}`}
        >
          {meta}
        </span>
      </div>
      <span className="truncate text-[12px] font-semibold text-sub">
        {[roadOnly(order.dropoff.address), order.dropoff.detailAddress]
          .filter(Boolean)
          .join(" ")}
      </span>
      <span className="truncate text-[12px] font-semibold text-muted">
        {order.driverName
          ? `${order.driverName} 라이더`
          : "주변 라이더에게 알렸어요"}
      </span>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold">{paymentLine(order)}</span>
        <span className="tnum font-mono text-[11px] font-bold text-muted">
          {shortCode(order)}
        </span>
      </div>
    </button>
  );
}

/** 배달 상태가 바뀌면 알림음과 브라우저 알림. 처음 받은 목록에는 울리지 않는다. */
function useStatusAlerts(orders: Order[]) {
  const seen = useRef<Map<string, OrderStatus> | null>(null);
  useEffect(() => {
    const previous = seen.current;
    const next = new Map(orders.map((order) => [order.id, order.status]));
    seen.current = next;
    if (!previous) return;
    const changed = orders.filter((order) => {
      const before = previous.get(order.id);
      return before !== undefined && before !== order.status;
    });
    if (changed.length === 0) return;
    beep();
    for (const order of changed) {
      notify(
        statusChip(order.status).label,
        `${order.dropoff.dong ?? roadOnly(order.dropoff.address)} · 끝자리 ${shortCode(order)}`,
      );
    }
  }, [orders]);
}
