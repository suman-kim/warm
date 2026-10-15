import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { settlementsApi } from "../../api/admin";
import { errorMessage } from "../../api/client";
import type { PayoutBatch, Settlement, SettlementWeek } from "../../api/types";
import { Chip } from "../../ui/chip";
import {
  addDays,
  dateTime,
  monthDay,
  shortDotted,
  weekday,
  weekLabel,
  won,
} from "../../ui/format";
import { nextPage } from "../../ui/hooks";
import { ChevronLeftIcon, ChevronRightIcon } from "../../ui/icons";
import {
  ActionButton,
  CheckBox,
  FormError,
  ListState,
  LoadMore,
  Modal,
  PageTitle,
  TableCard,
  TableHead,
  TableRow,
  Tabs,
} from "../../ui/kit";
import { useToast } from "../../ui/toast";

const DRIVER_COLUMNS =
  "24px minmax(110px,1fr) 150px 56px 112px 100px 92px 112px 96px";
const HISTORY_COLUMNS =
  "150px minmax(100px,1fr) 120px 150px 110px minmax(130px,1fr) 80px";

/** 지급할 수 있는 정산: 지급 대기, 그리고 앞선 지급이 실패한 것. */
const payable = (item: Settlement) =>
  item.status === "WAITING" || item.status === "FAILED";

/** 국민 ••••1024 */
function account(bankName: string, maskedAccountNumber: string): string {
  return `${bankName} ${maskedAccountNumber}`;
}

/** 10.05 – 10.11 */
function range(weekStart: string, weekEnd: string): string {
  return `${shortDotted(weekStart)} – ${shortDotted(weekEnd)}`;
}

export function SettlePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  // 주를 고르지 않으면 가장 최근에 끝난 주를 본다.
  const [weekStart, setWeekStart] = useState<string | undefined>();
  const [tab, setTab] = useState<"drivers" | "history">("drivers");
  const [selected, setSelected] = useState<string[]>([]);
  const [paying, setPaying] = useState(false);
  /** 마지막으로 처리한 지급의 결과 (그 주를 보는 동안 보여 준다). */
  const [batch, setBatch] = useState<PayoutBatch | null>(null);
  const week = useQuery({
    queryKey: ["settle", "week", weekStart ?? "latest"],
    queryFn: () => settlementsApi.week(weekStart),
    placeholderData: keepPreviousData,
  });
  const history = useInfiniteQuery({
    queryKey: ["settle", "payouts"],
    queryFn: ({ pageParam }) => settlementsApi.payouts(pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: tab === "history",
  });
  const pay = useMutation({
    mutationFn: (current: SettlementWeek) =>
      settlementsApi.pay(current.weekStart, selected),
    onSuccess: (result) => {
      queryClient.setQueryData(
        ["settle", "week", weekStart ?? "latest"],
        result.week,
      );
      void queryClient.invalidateQueries({ queryKey: ["settle", "payouts"] });
      toast(
        result.failures.length > 0
          ? `${result.requested}명 중 ${result.failures.length}명은 지급하지 못했어요`
          : `${result.requested}명 지급 처리했어요`,
      );
      setBatch(result);
      setSelected([]);
      setPaying(false);
    },
  });

  const data = week.data;
  const items = data?.items ?? [];
  const waiting = items.filter(payable);
  const picked = items.filter((item) => selected.includes(item.driverId));
  const pickedTotal = picked.reduce((sum, item) => sum + item.net, 0);
  const allPicked =
    waiting.length > 0 &&
    waiting.every((item) => selected.includes(item.driverId));
  const payouts = history.data?.pages.flatMap((page) => page.items) ?? [];
  const move = (days: number) => {
    if (data) {
      setWeekStart(addDays(data.weekStart, days));
      setSelected([]);
      setBatch(null);
    }
  };
  const toggle = (item: Settlement) => {
    if (item.status === "HOLD") {
      toast(
        item.bankName
          ? "기사님이 앱에서 계좌를 다시 인증해야 지급할 수 있어요"
          : "기사님이 앱에서 정산 계좌를 등록해야 지급할 수 있어요",
      );
    } else if (payable(item)) {
      setSelected(
        selected.includes(item.driverId)
          ? selected.filter((id) => id !== item.driverId)
          : [...selected, item.driverId],
      );
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="정산"
          sub={
            data
              ? `한 주 운행분을 모아 매주 ${weekday(data.payoutDate)}요일에 지급해요`
              : "한 주 운행분을 모아 지급해요"
          }
        />
        <div className="ring-line flex h-11 items-center rounded-[14px] bg-white">
          <button
            type="button"
            aria-label="이전 주"
            disabled={!data}
            onClick={() => move(-7)}
            className="flex h-11 w-[42px] items-center justify-center disabled:opacity-30"
          >
            <ChevronLeftIcon />
          </button>
          <span className="tnum flex min-w-[180px] items-baseline justify-center gap-2 px-1.5 text-[15px] font-extrabold">
            {data ? weekLabel(data.weekStart) : ""}
            <span className="text-[13px] font-semibold text-muted">
              {data ? range(data.weekStart, data.weekEnd) : ""}
            </span>
          </span>
          <button
            type="button"
            aria-label="다음 주"
            disabled={!data || data.latest}
            onClick={() => move(7)}
            className="flex h-11 w-[42px] items-center justify-center disabled:opacity-30"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
        {[
          ["정산 대상", data ? `${data.totals.drivers}명` : "–"],
          ["운행 매출", data ? won(data.totals.gross) : "–"],
          [
            `수수료 ${data?.commissionPercent ?? ""}%`,
            data ? won(data.totals.fee) : "–",
          ],
          ["지급 대기", data ? won(data.totals.unpaidNet) : "–"],
        ].map(([key, value]) => (
          <div
            key={key}
            className="flex flex-col gap-3 rounded-[18px] bg-white px-[18px] py-4"
          >
            <span className="text-[13px] font-bold text-muted">{key}</span>
            <span className="tnum text-[24px] leading-none font-extrabold tracking-[-0.03em]">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="정산 보기"
          value={tab}
          onChange={setTab}
          items={[
            { key: "drivers", label: "기사별 정산" },
            { key: "history", label: "지급 내역" },
          ]}
        />
        <span className="text-[13px] font-bold text-muted">
          {tab === "history"
            ? "최근 처리한 순서로 보여요"
            : data && payNote(data)}
        </span>
      </div>

      {tab === "drivers" && (
        <>
          {batch && data && batch.week.weekStart === data.weekStart && (
            <div className="flex flex-col gap-1.5 rounded-2xl bg-white px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-[15px] font-extrabold">
                  {dateTime(batch.requestedAt)} 지급 결과
                </span>
                <span className="tnum text-[14px] font-bold text-sub">
                  진행 중 {batch.processing}명
                </span>
                <span className="tnum text-[14px] font-bold text-ok">
                  성공 {batch.paid}명
                </span>
                <span
                  className={`tnum text-[14px] font-bold ${
                    batch.failures.length > 0 ? "text-danger" : "text-sub"
                  }`}
                >
                  실패 {batch.failures.length}명
                </span>
              </div>
              {batch.failures.length > 0 ? (
                <span className="text-[13px] font-semibold text-danger-deep">
                  {batch.failures
                    .map(
                      (failure) => `${failure.driverName} · ${failure.reason}`,
                    )
                    .join(" / ")}{" "}
                  — 사유를 확인한 뒤 다시 지급해 주세요.
                </span>
              ) : (
                <span className="text-[13px] font-semibold text-muted">
                  {batch.processing > 0
                    ? "은행에서 결과가 오면 목록이 바뀌어요."
                    : "모두 지급했어요."}
                </span>
              )}
            </div>
          )}
          {picked.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-ink py-2 pr-2 pl-5 text-white">
              <span className="tnum flex-1 text-[15px] font-extrabold">
                {picked.length}명 선택 · {won(pickedTotal)}
              </span>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="h-10 rounded-xl px-3.5 text-[14px] font-bold text-dim"
              >
                선택 해제
              </button>
              <button
                type="button"
                onClick={() => {
                  pay.reset();
                  setPaying(true);
                }}
                className="h-10 rounded-xl bg-lime px-[18px] text-[14px] font-extrabold text-ink"
              >
                지급 처리
              </button>
            </div>
          )}
          <TableCard minWidth={1000}>
            <TableHead columns={DRIVER_COLUMNS} height={48}>
              <CheckBox
                label="지급 대기 모두 고르기"
                checked={allPicked}
                disabled={waiting.length === 0}
                onChange={() =>
                  setSelected(
                    allPicked ? [] : waiting.map((item) => item.driverId),
                  )
                }
              />
              <span>기사</span>
              <span>지급 계좌</span>
              <span className="text-right">운행</span>
              <span className="text-right">운행 매출</span>
              <span className="text-right">수수료</span>
              <span className="text-right">취소 보상</span>
              <span className="text-right">정산액</span>
              <span>상태</span>
            </TableHead>
            {items.map((item) => {
              const on = selected.includes(item.driverId);
              return (
                <TableRow
                  key={item.driverId}
                  columns={DRIVER_COLUMNS}
                  className={`h-[58px] ${on ? "bg-hover" : ""}`}
                >
                  <CheckBox
                    label={`${item.driverName} 고르기`}
                    checked={on}
                    disabled={
                      item.status === "PAID" || item.status === "PAYING"
                    }
                    dim={item.status === "HOLD"}
                    onChange={() => toggle(item)}
                  />
                  <span className="truncate text-[15px] font-extrabold">
                    {item.driverName}
                  </span>
                  {item.status === "HOLD" ? (
                    <span
                      title={item.reason ?? undefined}
                      className="truncate font-extrabold text-danger"
                    >
                      {item.bankName ? "계좌 인증 실패" : "계좌 없음"}
                    </span>
                  ) : item.bankName && item.maskedAccountNumber ? (
                    <span className="text-body">
                      {account(item.bankName, item.maskedAccountNumber)}
                    </span>
                  ) : (
                    <span className="font-extrabold text-danger">
                      계좌 없음
                    </span>
                  )}
                  <span className="tnum text-right">{item.trips}건</span>
                  <span className="tnum text-right">{won(item.gross)}</span>
                  <span className="tnum text-right text-muted">
                    −{won(item.fee)}
                  </span>
                  <span className="tnum text-right text-muted">
                    {item.compensation > 0 ? `+${won(item.compensation)}` : "—"}
                  </span>
                  <span className="tnum text-right font-extrabold">
                    {won(item.net)}
                  </span>
                  <div title={item.reason ?? undefined}>
                    <Chip kind={item.status} />
                  </div>
                </TableRow>
              );
            })}
            <ListState
              loading={week.isPending}
              error={week.isError}
              empty={items.length === 0}
              emptyText="이 주에 완료한 배송이 없어요"
              onRetry={() => week.refetch()}
            />
          </TableCard>
        </>
      )}

      {tab === "history" && (
        <>
          <TableCard minWidth={960}>
            <TableHead columns={HISTORY_COLUMNS}>
              <span>지급 처리</span>
              <span>기사</span>
              <span>정산 기간</span>
              <span>지급 계좌</span>
              <span className="text-right">금액</span>
              <span>결과</span>
              <span>처리자</span>
            </TableHead>
            {payouts.map((payout) => (
              <TableRow
                key={payout.id}
                columns={HISTORY_COLUMNS}
                className="h-[54px]"
              >
                <span className="tnum text-body">
                  {dateTime(payout.paidAt)}
                </span>
                <span className="truncate font-extrabold">
                  {payout.driverName}
                </span>
                <span className="tnum">
                  {range(payout.weekStart, payout.weekEnd)}
                </span>
                <span>
                  {account(payout.bankName, payout.maskedAccountNumber)}
                </span>
                <span className="tnum text-right font-extrabold">
                  {won(payout.amount)}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <Chip kind={`PAYOUT_${payout.status}`} />
                  {payout.failureReason && (
                    <span className="truncate text-[12px] font-semibold text-danger-deep">
                      {payout.failureReason}
                    </span>
                  )}
                </span>
                <span className="truncate text-body">
                  {payout.paidByName ?? "—"}
                </span>
              </TableRow>
            ))}
            <ListState
              loading={history.isPending}
              error={history.isError}
              empty={payouts.length === 0}
              emptyText="아직 지급 처리한 정산이 없어요"
              onRetry={() => history.refetch()}
            />
          </TableCard>
          <LoadMore
            shown={payouts.length}
            total={history.data?.pages[0].total ?? 0}
            loading={history.isFetchingNextPage}
            onMore={() => history.fetchNextPage()}
          />
        </>
      )}

      {paying && data && (
        <Modal label="지급 처리" width={480} onClose={() => setPaying(false)}>
          <div className="flex flex-col gap-1.5">
            <span className="text-[21px] font-extrabold tracking-[-0.02em]">
              지급 처리할까요?
            </span>
            <span className="text-[14px] font-semibold text-muted">
              {weekLabel(data.weekStart)} ·{" "}
              {range(data.weekStart, data.weekEnd)}
            </span>
          </div>
          <div className="rounded-[18px] bg-paper px-[18px] py-1">
            {picked.map((item) => (
              <div
                key={item.driverId}
                className="flex items-center justify-between gap-3 border-b border-well py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold">
                    {item.driverName}
                  </span>
                  <span className="text-[12px] font-semibold text-muted">
                    {account(
                      item.bankName ?? "",
                      item.maskedAccountNumber ?? "",
                    )}
                  </span>
                </div>
                <span className="tnum text-[15px] font-bold">
                  {won(item.net)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3.5">
              <span className="text-[15px] font-extrabold">합계</span>
              <span className="tnum text-[19px] font-extrabold">
                {won(pickedTotal)}
              </span>
            </div>
          </div>
          <span className="text-[13px] leading-[1.5] font-semibold text-muted">
            지금은 수동 지급이에요 — 등록된 계좌로 먼저 이체한 뒤에 처리해
            주세요. 처리하면 지급 완료로 기록되고 되돌릴 수 없어요.
          </span>
          <FormError message={pay.isError ? errorMessage(pay.error) : null} />
          <div className="flex justify-end gap-2">
            <ActionButton tone="soft" onClick={() => setPaying(false)}>
              취소
            </ActionButton>
            <ActionButton
              disabled={pay.isPending}
              onClick={() => pay.mutate(data)}
            >
              {picked.length}명 지급 처리
            </ActionButton>
          </div>
        </Modal>
      )}
    </>
  );
}

/** 탭 옆의 한 줄 — 지급 예정일, 또는 모두 지급했으면 지급한 날. */
function payNote(week: SettlementWeek): string {
  if (week.items.length === 0) {
    return "";
  }
  if (week.items.some((item) => item.status !== "PAID")) {
    return `지급 예정일 ${shortDotted(week.payoutDate)} (${weekday(week.payoutDate)})`;
  }
  const lastPaidAt = week.items
    .map((item) => item.paidAt ?? "")
    .sort()
    .at(-1)!;
  return `${monthDay(lastPaidAt)} 지급 완료`;
}
