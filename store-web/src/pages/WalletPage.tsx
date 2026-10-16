import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "../api/client";
import { storeApi } from "../api/store";
import type { WalletEntryKind } from "../api/types";
import { TopBar } from "../layout/Shell";
import { monthDayTime, won } from "../ui/format";
import { useToast } from "../ui/toast";

const KINDS: Record<WalletEntryKind, string> = {
  TOP_UP: "충전",
  DELIVERY_FEE: "배달대행료",
  REFUND: "환불",
  ADJUSTMENT: "운영자 조정",
};
const PRESETS = [50_000, 100_000, 300_000];
const MIN = 10_000;
const MAX = 2_000_000;

/**
 * 충전금. 지금 잔액과 충전하기, 충전금 내역.
 * 아직 포트원 가상계좌·카드 충전을 붙이지 않아서, 개발 서버는 고른 방식과 상관없이 바로 충전한다.
 */
export function WalletPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState(100_000);
  const [method, setMethod] = useState<"VA" | "CARD">("VA");
  const [invalid, setInvalid] = useState<string | null>(null);
  const wallet = useQuery({
    queryKey: ["wallet"],
    queryFn: () => storeApi.wallet(),
    refetchInterval: 30_000,
  });
  const topUp = useMutation({
    mutationFn: () => storeApi.topUp(amount),
    onSuccess: (entry) => {
      toast(
        `${won(entry.amount)}을 충전했어요 · 지금 잔액 ${won(entry.balanceAfter)}`,
      );
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["store"] });
    },
  });
  const submit = () => {
    if (amount < MIN || amount > MAX) {
      setInvalid("10,000원부터 2,000,000원까지 충전할 수 있어요");
      return;
    }
    topUp.mutate();
  };
  const rows = wallet.data?.items ?? [];

  return (
    <>
      <TopBar
        title="충전금"
        updatedAt={wallet.dataUpdatedAt}
        onRefresh={() => wallet.refetch()}
      />
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-5">
        <div className="flex w-[340px] flex-none flex-col gap-3 overflow-y-auto">
          <div className="flex flex-col gap-2 rounded-[22px] bg-ink p-5 text-white">
            <span className="text-[12px] font-bold text-nav">지금 잔액</span>
            <span className="tnum text-[30px] font-extrabold tracking-[-0.03em]">
              {won(wallet.data?.balance ?? 0)}
            </span>
          </div>
          <div className="flex flex-col gap-3 rounded-[22px] bg-white p-5">
            <span className="text-[16px] font-extrabold">충전하기</span>
            <label
              className={`flex items-center gap-2 border-b-2 pb-2 ${invalid ? "border-danger" : "border-ink"}`}
            >
              <input
                inputMode="numeric"
                aria-label="충전 금액"
                value={amount ? amount.toLocaleString("ko-KR") : ""}
                onChange={(event) => {
                  setAmount(
                    Number(event.target.value.replace(/\D/g, "").slice(0, 8)) ||
                      0,
                  );
                  setInvalid(null);
                }}
                placeholder="0"
                className="tnum min-w-0 flex-1 bg-transparent text-[26px] font-extrabold outline-none"
              />
              <span className="text-[18px] font-extrabold">원</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={amount === value}
                  onClick={() => {
                    setAmount(value);
                    setInvalid(null);
                  }}
                  className={`h-10 rounded-[11px] text-[13px] font-extrabold ${
                    amount === value ? "bg-ink text-white" : "bg-hair"
                  }`}
                >
                  {value / 10_000}만원
                </button>
              ))}
            </div>
            <span
              className={`text-[12px] font-semibold ${invalid ? "font-bold text-danger" : "text-muted"}`}
            >
              10,000원부터 2,000,000원까지 충전할 수 있어요
            </span>
            {(
              [
                [
                  "VA",
                  "가상계좌 입금",
                  "계좌번호를 받아 입금하면 자동으로 충전돼요",
                ],
                ["CARD", "카드 충전", "PG사 결제 창에서 바로 충전해요"],
              ] as const
            ).map(([key, title, body]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={method === key}
                onClick={() => setMethod(key)}
                className={`flex items-center gap-3 rounded-[14px] px-4 py-3 text-left ${
                  method === key
                    ? "bg-white shadow-[inset_0_0_0_2px_#121212]"
                    : "bg-paper"
                }`}
              >
                <span
                  className={`size-5 flex-none rounded-full ${
                    method === key
                      ? "border-[6px] border-ink"
                      : "border-[1.5px] border-box"
                  }`}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-extrabold">{title}</span>
                  <span className="text-[12px] font-semibold text-muted">
                    {body}
                  </span>
                </span>
              </button>
            ))}
            {topUp.isError && (
              <span role="alert" className="text-[12px] font-bold text-danger">
                {errorMessage(topUp.error)}
              </span>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={topUp.isPending}
              className="h-[50px] rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-40"
            >
              {amount ? `${won(amount)} 충전하기` : "충전하기"}
            </button>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          <span className="text-[15px] font-extrabold">충전금 내역</span>
          <div className="min-h-0 flex-1 overflow-auto rounded-[20px] bg-white">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-rule text-[12px] text-muted">
                  {["일시", "구분", "금액", "잔액", "관련 배달", "메모"].map(
                    (label) => (
                      <th key={label} className="px-4 py-3 font-bold">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const plus = entry.amount > 0;
                  // 메모의 앞부분이 '동 · 끝자리'다 (역삼동 · 3F9A · …).
                  const code = entry.orderId
                    ? entry.memo?.split(" · ")[1]
                    : null;
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-rule last:border-b-0"
                    >
                      <td className="tnum px-4 py-3 font-semibold whitespace-nowrap">
                        {monthDayTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-extrabold whitespace-nowrap">
                        {KINDS[entry.kind]}
                      </td>
                      <td
                        className={`tnum px-4 py-3 font-extrabold whitespace-nowrap ${plus ? "text-ok-dot" : ""}`}
                      >
                        {plus ? "+" : "−"}
                        {won(Math.abs(entry.amount))}
                      </td>
                      <td className="tnum px-4 py-3 font-semibold whitespace-nowrap">
                        {won(entry.balanceAfter)}
                      </td>
                      <td className="tnum px-4 py-3 font-mono text-[12px] font-bold">
                        {code ?? "—"}
                      </td>
                      <td className="max-w-[280px] truncate px-4 py-3 font-semibold text-sub">
                        {entry.memo ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="px-4 py-10 text-center text-[14px] font-semibold text-muted">
                {wallet.isPending
                  ? "불러오는 중이에요"
                  : "충전금 내역이 없어요"}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
