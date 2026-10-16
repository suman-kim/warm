import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { storesApi } from "../../api/admin";
import type { WalletEntryKind } from "../../api/types";
import { Chip } from "../../ui/chip";
import { relativeTime, won } from "../../ui/format";
import {
  ListState,
  PageTitle,
  SearchField,
  TableCard,
  TableHead,
  TableRow,
} from "../../ui/kit";

const COLUMNS = "minmax(170px,1.4fr) 120px 110px 110px minmax(160px,1fr) 100px";

export const ENTRY_KINDS: Record<WalletEntryKind, string> = {
  TOP_UP: "충전",
  DELIVERY_FEE: "배달대행료",
  REFUND: "환불",
  ADJUSTMENT: "운영자 조정",
};

/** 가게 충전금 현황. 승인한 가게의 잔액과 오늘 충전·대행료를 보고, 가게를 누르면 내역과 조정으로 간다. */
export function WalletsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const overview = useQuery({
    queryKey: ["wallets", "overview"],
    queryFn: storesApi.wallets,
    refetchInterval: 60_000,
  });
  const keyword = search.trim();
  const rows = (overview.data?.items ?? []).filter(
    (row) => !keyword || row.name.includes(keyword),
  );
  return (
    <>
      <PageTitle
        title="가게 충전금"
        sub="승인한 가게의 충전금 잔액과 내역을 보고, 필요하면 금액을 조정해요"
      />
      <div className="flex flex-wrap gap-3">
        <Stat
          label="충전금 합계"
          value={won(overview.data?.totalBalance ?? 0)}
        />
        <Stat
          label="잔액 부족 가게"
          value={`${overview.data?.lowBalanceCount ?? 0}곳`}
          alert={(overview.data?.lowBalanceCount ?? 0) > 0}
        />
        <Stat label="오늘 충전" value={won(overview.data?.todayTopUps ?? 0)} />
      </div>
      <div className="flex justify-end">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="상호"
          className="w-[300px] max-w-full"
        />
      </div>
      <TableCard minWidth={820}>
        <TableHead columns={COLUMNS}>
          <span>상호</span>
          <span>잔액</span>
          <span>오늘 충전</span>
          <span>오늘 대행료</span>
          <span>마지막 내역</span>
          <span>상태</span>
        </TableHead>
        {rows.map((row) => (
          <TableRow
            key={row.storeId}
            columns={COLUMNS}
            onClick={() => navigate(`/wallets/${row.storeId}`)}
          >
            <span className="truncate text-[15px] font-extrabold">
              {row.name}
            </span>
            <span className="tnum font-extrabold">{won(row.balance)}</span>
            <span className="tnum text-body">{won(row.todayTopUps)}</span>
            <span className="tnum text-body">{won(row.todayFees)}</span>
            <span className="text-[13px] font-semibold text-muted">
              {row.lastEntryAt && row.lastEntryKind
                ? `${relativeTime(row.lastEntryAt)} · ${ENTRY_KINDS[row.lastEntryKind]}`
                : "내역 없음"}
            </span>
            <div>
              <Chip kind={row.low ? "WALLET_LOW" : "WALLET_OK"} />
            </div>
          </TableRow>
        ))}
        <ListState
          loading={overview.isPending}
          error={overview.isError}
          empty={rows.length === 0}
          onRetry={() => overview.refetch()}
          emptyText={keyword ? "찾는 가게가 없어요" : "승인한 가게가 없어요"}
        />
      </TableCard>
    </>
  );
}

export function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="flex min-w-[150px] flex-col gap-1.5 rounded-[18px] bg-white px-[18px] py-4">
      <span className="text-[12px] font-bold text-muted">{label}</span>
      <span
        className={`tnum text-[22px] font-extrabold tracking-[-0.02em] ${
          alert ? "text-danger" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
