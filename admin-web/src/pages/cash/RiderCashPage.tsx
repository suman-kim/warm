import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { riderCashApi } from "../../api/admin";
import { errorMessage } from "../../api/client";
import type { RiderCashItem } from "../../api/types";
import { Chip } from "../../ui/chip";
import { relativeTime, todayKst, won } from "../../ui/format";
import {
  ConfirmModal,
  ListState,
  PageTitle,
  TableCard,
  TableHead,
  TableRow,
  Tabs,
} from "../../ui/kit";
import { useToast } from "../../ui/toast";
import { Stat } from "../wallets/WalletsPage";

const COLUMNS = "110px 150px 100px minmax(150px,1.3fr) 110px 110px 130px";

type Tab = "ALL" | "PENDING" | "HANDED";

/** 라이더 현금 수금. 라이더가 만나서 현금으로 받은 음식값을 가게에 넘겼는지 본다. */
export function RiderCashPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("ALL");
  const [marking, setMarking] = useState<RiderCashItem | null>(null);
  const date = todayKst();
  const cash = useQuery({
    queryKey: ["rider-cash", date, tab],
    queryFn: () =>
      riderCashApi.list(date, tab === "ALL" ? undefined : tab === "HANDED"),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  const mark = useMutation({
    mutationFn: (item: RiderCashItem) =>
      riderCashApi.mark(item.orderId, !item.handedAt),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["rider-cash"] });
      setMarking(null);
      toast(
        result.handedAt
          ? "가게에 넘긴 것으로 표시했어요"
          : "아직 안 넘긴 것으로 되돌렸어요",
      );
    },
  });
  const summary = cash.data?.summary;
  const rows = cash.data?.items ?? [];
  const handedCount = (summary?.count ?? 0) - (summary?.pendingCount ?? 0);
  return (
    <>
      <PageTitle
        title="라이더 현금 수금"
        sub="라이더가 만나서 현금으로 받은 음식값과 가게에 넘겼는지 확인해요"
      />
      <div className="flex flex-wrap gap-3">
        <Stat label="오늘 받은 현금" value={won(summary?.total ?? 0)} />
        <Stat label="가게에 넘김" value={won(summary?.handed ?? 0)} />
        <Stat
          label="아직 안 넘김"
          value={`${won(summary?.pending ?? 0)} · ${summary?.pendingCount ?? 0}건`}
          alert={(summary?.pendingCount ?? 0) > 0}
        />
      </div>
      <Tabs
        label="넘김 여부"
        value={tab}
        onChange={setTab}
        className="self-start"
        items={[
          { key: "ALL", label: "전체", count: summary?.count ?? 0 },
          {
            key: "PENDING",
            label: "아직 안 넘김",
            count: summary?.pendingCount ?? 0,
          },
          { key: "HANDED", label: "가게에 넘김", count: handedCount },
        ]}
      />
      <TableCard minWidth={880}>
        <TableHead columns={COLUMNS}>
          <span>전달 시각</span>
          <span>주문번호</span>
          <span>라이더</span>
          <span>가게</span>
          <span>받은 금액</span>
          <span>음식값</span>
          <span>가게에 넘김</span>
        </TableHead>
        {rows.map((row) => (
          <TableRow key={row.orderId} columns={COLUMNS}>
            <span className="tnum text-body">
              {relativeTime(row.deliveredAt)}
            </span>
            <span className="tnum font-mono text-[13px] font-bold">
              {row.code}
            </span>
            <span className="font-extrabold">{row.riderName ?? "—"}</span>
            <span className="truncate text-body">{row.storeName}</span>
            <span className="tnum font-extrabold">
              {won(row.collectedAmount)}
            </span>
            <span
              className={`tnum ${
                row.foodAmount !== row.collectedAmount
                  ? "font-extrabold text-danger"
                  : "text-body"
              }`}
            >
              {won(row.foodAmount)}
            </span>
            <button
              type="button"
              onClick={() => setMarking(row)}
              className="self-center justify-self-start"
              aria-label={`${row.code} ${row.handedAt ? "가게에 넘김" : "아직 안 넘김"} — 바꾸기`}
            >
              <Chip kind={row.handedAt ? "CASH_HANDED" : "CASH_PENDING"} />
            </button>
          </TableRow>
        ))}
        <ListState
          loading={cash.isPending}
          error={cash.isError}
          empty={rows.length === 0}
          onRetry={() => cash.refetch()}
          emptyText="오늘 현금으로 받은 배달이 없어요"
        />
      </TableCard>
      {marking && (
        <ConfirmModal
          title={
            marking.handedAt
              ? "아직 안 넘긴 것으로 되돌릴까요?"
              : "가게에 넘긴 것으로 표시할까요?"
          }
          body={`${marking.riderName ?? "라이더"} · ${marking.storeName} · ${won(marking.collectedAmount)}`}
          confirm={marking.handedAt ? "되돌리기" : "넘김 표시"}
          busy={mark.isPending}
          error={mark.isError ? errorMessage(mark.error) : null}
          onConfirm={() => mark.mutate(marking)}
          onClose={() => setMarking(null)}
        />
      )}
    </>
  );
}
