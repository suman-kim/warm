import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { storesApi } from "../../api/admin";
import { errorMessage } from "../../api/client";
import type { WalletEntry } from "../../api/types";
import { businessNumber, orderCode, relativeTime, won } from "../../ui/format";
import { nextPage } from "../../ui/hooks";
import { BackIcon } from "../../ui/icons";
import {
  ActionButton,
  FormError,
  ListState,
  LoadMore,
  Modal,
  ModalHeader,
  TableCard,
  TableHead,
  TableRow,
} from "../../ui/kit";
import { useToast } from "../../ui/toast";
import { ENTRY_KINDS } from "./WalletsPage";

const COLUMNS = "100px 110px 110px 110px 150px minmax(160px,1.4fr) 80px";

/** 한 가게의 충전금 내역과 운영자 조정. */
export function WalletDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [adjusting, setAdjusting] = useState(false);
  const store = useQuery({
    queryKey: ["stores", "detail", id],
    queryFn: () => storesApi.detail(id),
  });
  const entries = useInfiniteQuery({
    queryKey: ["wallets", "entries", id],
    queryFn: ({ pageParam }) => storesApi.wallet(id, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    placeholderData: keepPreviousData,
  });
  const adjust = useMutation({
    mutationFn: (input: { amount: number; memo: string }) =>
      storesApi.adjust(id, input.amount, input.memo),
    onSuccess: (entry) => {
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      void queryClient.invalidateQueries({
        queryKey: ["stores", "detail", id],
      });
      setAdjusting(false);
      toast(`조정했어요. 지금 잔액 ${won(entry.balanceAfter)}`);
    },
  });
  const first = entries.data?.pages[0];
  const rows = entries.data?.pages.flatMap((page) => page.items) ?? [];
  const balance = first?.balance ?? store.data?.walletBalance ?? 0;

  return (
    <>
      <Link
        to="/wallets"
        className="-ml-1 flex h-8 items-center gap-1 self-start text-[14px] font-bold text-sub"
      >
        <BackIcon />
        가게 충전금
      </Link>
      <div className="-mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.03em]">
            {store.data?.name ?? "가게"}
          </h1>
          {store.data && (
            <span className="text-[14px] font-semibold text-muted">
              {[store.data.address.address, store.data.address.detailAddress]
                .filter(Boolean)
                .join(" ")}{" "}
              · 사업자 {businessNumber(store.data.businessNumber)}
            </span>
          )}
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[12px] font-bold text-muted">지금 잔액</span>
            <span className="tnum text-[26px] font-extrabold tracking-[-0.03em]">
              {won(balance)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAdjusting(true)}
            className="h-[46px] rounded-[14px] bg-ink px-[22px] text-[15px] font-extrabold text-white"
          >
            조정
          </button>
        </div>
      </div>
      <TableCard minWidth={860}>
        <TableHead columns={COLUMNS}>
          <span>일시</span>
          <span>구분</span>
          <span>금액</span>
          <span>잔액</span>
          <span>관련 배달</span>
          <span>메모</span>
          <span>처리자</span>
        </TableHead>
        {rows.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
        <ListState
          loading={entries.isPending}
          error={entries.isError}
          empty={rows.length === 0}
          onRetry={() => entries.refetch()}
          emptyText="충전금 내역이 없어요"
        />
      </TableCard>
      <LoadMore
        shown={rows.length}
        total={first?.total ?? 0}
        loading={entries.isFetchingNextPage}
        onMore={() => entries.fetchNextPage()}
      />
      {adjusting && (
        <AdjustModal
          name={store.data?.name ?? ""}
          balance={balance}
          busy={adjust.isPending}
          error={adjust.isError ? errorMessage(adjust.error) : null}
          onSubmit={(amount, memo) => adjust.mutate({ amount, memo })}
          onClose={() => setAdjusting(false)}
        />
      )}
    </>
  );
}

function EntryRow({ entry }: { entry: WalletEntry }) {
  const plus = entry.amount > 0;
  return (
    <TableRow columns={COLUMNS}>
      <span className="tnum text-body">{relativeTime(entry.createdAt)}</span>
      <span className="font-extrabold">{ENTRY_KINDS[entry.kind]}</span>
      <span className={`tnum font-extrabold ${plus ? "text-ok-dot" : ""}`}>
        {plus ? "+" : "−"}
        {won(Math.abs(entry.amount))}
      </span>
      <span className="tnum text-body">{won(entry.balanceAfter)}</span>
      <span className="tnum font-mono text-[13px] font-bold">
        {entry.orderId ? orderCode(entry.orderId, entry.createdAt) : "—"}
      </span>
      <span className="truncate text-[13px] font-semibold text-body">
        {entry.memo ?? ""}
      </span>
      <span className="text-[13px] font-semibold text-muted">
        {entry.kind === "ADJUSTMENT" ? "운영자" : "시스템"}
      </span>
    </TableRow>
  );
}

function AdjustModal({
  name,
  balance,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  name: string;
  balance: number;
  busy: boolean;
  error: string | null;
  onSubmit: (amount: number, memo: string) => void;
  onClose: () => void;
}) {
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const value = Number(amount.replace(/\D/g, "")) || 0;
  const submit = () => {
    if (value === 0) {
      setInvalid("조정 금액을 적어 주세요");
    } else if (sign < 0 && value > balance) {
      setInvalid("잔액보다 많이 뺄 수 없어요");
    } else if (!memo.trim()) {
      setInvalid("조정 사유를 적어 주세요 — 사장님 앱의 내역에 보여요");
    } else {
      onSubmit(sign * value, memo.trim());
    }
  };
  return (
    <Modal label="충전금 조정" width={480} gap={20} onClose={onClose}>
      <ModalHeader
        title="충전금 조정"
        sub={`${name} · 지금 잔액 ${won(balance)}`}
        onClose={onClose}
      />
      <div className="flex gap-1 rounded-[14px] bg-well p-1">
        {([1, -1] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSign(option)}
            aria-pressed={sign === option}
            className={`h-10 flex-1 rounded-[11px] text-[14px] font-extrabold ${
              sign === option ? "bg-ink text-white" : "text-tab"
            }`}
          >
            {option > 0 ? "더하기" : "빼기"}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-extrabold">금액</span>
        <span className="flex items-center gap-2 rounded-[14px] px-4 shadow-[inset_0_0_0_1.5px_#DAD8D1]">
          <input
            inputMode="numeric"
            value={value ? value.toLocaleString("ko-KR") : ""}
            onChange={(event) => {
              setAmount(event.target.value);
              setInvalid(null);
            }}
            placeholder="0"
            className="tnum h-12 flex-1 bg-transparent text-[18px] font-extrabold outline-none"
          />
          <span className="font-extrabold">원</span>
        </span>
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-extrabold">사유</span>
        <input
          value={memo}
          maxLength={100}
          onChange={(event) => {
            setMemo(event.target.value);
            setInvalid(null);
          }}
          placeholder="예: 10월 13일 배차 지연 보상"
          className="h-12 rounded-[14px] px-4 text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_#DAD8D1] outline-none focus:shadow-[inset_0_0_0_2px_#121212]"
        />
      </label>
      <FormError message={invalid ?? error} />
      <div className="flex justify-end gap-2">
        <ActionButton tone="soft" onClick={onClose}>
          닫기
        </ActionButton>
        <ActionButton disabled={busy} onClick={submit}>
          {sign > 0 ? `${won(value)} 더하기` : `${won(value)} 빼기`}
        </ActionButton>
      </div>
    </Modal>
  );
}
