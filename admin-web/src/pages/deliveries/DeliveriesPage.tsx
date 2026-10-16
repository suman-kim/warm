import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { deliveriesApi } from "../../api/admin";
import type {
  DeliveryFlag,
  DeliveryMonitorItem,
  DoorPayment,
  OrderStatus,
} from "../../api/types";
import { Chip, type ChipKind } from "../../ui/chip";
import { won } from "../../ui/format";
import {
  ListState,
  PageTitle,
  TableCard,
  TableHead,
  TableRow,
  Tabs,
} from "../../ui/kit";
import { Stat } from "../wallets/WalletsPage";

const COLUMNS =
  "150px minmax(140px,1.2fr) 100px 140px 70px 90px 150px minmax(130px,1fr)";

const STATUS_CHIPS: Partial<Record<OrderStatus, ChipKind>> = {
  REQUESTED: "DLV_REQUESTED",
  ASSIGNED: "DLV_TO_STORE",
  DEPARTED: "DLV_TO_STORE",
  ARRIVED: "DLV_AT_STORE",
  PICKED_UP: "DLV_PICKED_UP",
};

const PAYMENTS: Record<DoorPayment, string> = {
  PREPAID: "선결제",
  CASH: "만나서 현금",
  CARD: "만나서 카드",
};

type Tab = "ALL" | DeliveryFlag;

/** 배달 관제. 진행 중인 가게 배달을 단계별로 보고, 오래 배차되지 않았거나 픽업이 늦은 건을 위로 올린다. */
export function DeliveriesPage() {
  const [tab, setTab] = useState<Tab>("ALL");
  const monitor = useQuery({
    queryKey: ["deliveries", tab],
    queryFn: () => deliveriesApi.monitor(tab === "ALL" ? undefined : tab),
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });
  const summary = monitor.data?.summary;
  const total =
    (summary?.searching ?? 0) +
    (summary?.toStore ?? 0) +
    (summary?.atStore ?? 0) +
    (summary?.delivering ?? 0);
  const rows = monitor.data?.items ?? [];
  return (
    <>
      <PageTitle
        title="배달 관제"
        sub="지금 진행 중인 배달이에요. 오래 배차되지 않은 건과 픽업이 늦은 건을 위로 올려 보여줘요"
      />
      <div className="flex flex-wrap gap-3">
        <Stat label="라이더 찾는 중" value={`${summary?.searching ?? 0}건`} />
        <Stat label="가게로 오는 중" value={`${summary?.toStore ?? 0}건`} />
        <Stat label="라이더 가게 도착" value={`${summary?.atStore ?? 0}건`} />
        <Stat label="배달 중" value={`${summary?.delivering ?? 0}건`} />
        <Stat
          label="배차 지연"
          value={`${summary?.dispatchLate ?? 0}건`}
          alert={(summary?.dispatchLate ?? 0) > 0}
        />
        <Stat
          label="픽업 지연"
          value={`${summary?.pickupLate ?? 0}건`}
          alert={(summary?.pickupLate ?? 0) > 0}
        />
      </div>
      <Tabs
        label="알림"
        value={tab}
        onChange={setTab}
        className="self-start"
        items={[
          { key: "ALL", label: "전체", count: total },
          {
            key: "DISPATCH_LATE",
            label: "배차 지연",
            count: summary?.dispatchLate ?? 0,
          },
          {
            key: "PICKUP_LATE",
            label: "픽업 지연",
            count: summary?.pickupLate ?? 0,
          },
        ]}
      />
      <TableCard minWidth={980}>
        <TableHead columns={COLUMNS}>
          <span>주문번호</span>
          <span>가게</span>
          <span>손님 동</span>
          <span>상태</span>
          <span>경과</span>
          <span>라이더</span>
          <span>결제</span>
          <span>알림</span>
        </TableHead>
        {rows.map((row) => (
          <Row key={row.id} row={row} />
        ))}
        <ListState
          loading={monitor.isPending}
          error={monitor.isError}
          empty={rows.length === 0}
          onRetry={() => monitor.refetch()}
          emptyText={
            tab === "ALL" ? "진행 중인 배달이 없어요" : "늦어진 배달이 없어요"
          }
        />
      </TableCard>
      <span className="text-[13px] font-semibold text-muted">
        배차 지연은 요청하고 10분, 픽업 지연은 요청하고 20분이 지난 건이에요.
        15초마다 새로 받아요.
      </span>
    </>
  );
}

function Row({ row }: { row: DeliveryMonitorItem }) {
  const chip = STATUS_CHIPS[row.status];
  return (
    <TableRow columns={COLUMNS}>
      <span className="tnum font-mono text-[13px] font-bold">{row.code}</span>
      <span className="truncate font-extrabold">{row.storeName}</span>
      <span className="text-body">{row.customerArea}</span>
      <div>{chip && <Chip kind={chip} />}</div>
      <span className="tnum text-body">{row.elapsedMinutes}분</span>
      <span className="text-body">{row.riderName ?? "—"}</span>
      <span className="text-[13px] font-semibold text-body">
        {PAYMENTS[row.doorPayment]}
        {row.doorPayment !== "PREPAID" && ` ${won(row.foodAmount)}`}
      </span>
      <div>
        {row.flag && (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-lg bg-danger-soft px-[9px] text-[12px] font-extrabold whitespace-nowrap text-danger">
            <span className="size-1.5 rounded-full bg-danger" />
            {row.flag === "DISPATCH_LATE" ? "배차 지연" : "픽업 지연"}{" "}
            {row.elapsedMinutes}분
          </span>
        )}
      </div>
    </TableRow>
  );
}
