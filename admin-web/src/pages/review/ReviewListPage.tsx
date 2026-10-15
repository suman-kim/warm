import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { reviewApi } from "../../api/admin";
import type { DriverApplication, DriverStatus } from "../../api/types";
import { Chip } from "../../ui/chip";
import {
  documentLabel,
  phone,
  plate,
  shortDateTime,
  vehicleLabel,
} from "../../ui/format";
import { nextPage, useDebounced } from "../../ui/hooks";
import {
  ListState,
  LoadMore,
  PageTitle,
  SearchField,
  TableCard,
  TableHead,
  TableRow,
  Tabs,
} from "../../ui/kit";

const COLUMNS =
  "minmax(190px,1.4fr) 130px minmax(140px,1fr) 110px minmax(170px,1fr) 100px";

/** 서류 칸에 보일 한 줄 — 반려된 서류, 다시 낸 서류, 아니면 몇 종을 냈는지. */
export function documentsSummary(application: DriverApplication): {
  text: string;
  alert: boolean;
} {
  const names = (pick: (typeof application.documents)[number][]) =>
    pick.map((document) => documentLabel(document.type)).join(", ");
  const rejected = application.documents.filter(
    (document) => document.status === "REJECTED",
  );
  if (rejected.length > 0) {
    return { text: `${names(rejected)} 반려`, alert: true };
  }
  const resubmitted = application.documents.filter(
    (document) => document.resubmitted,
  );
  if (resubmitted.length > 0) {
    return { text: `${names(resubmitted)} 다시 제출`, alert: false };
  }
  const count = application.documents.filter(
    (document) => document.status !== "NOT_SUBMITTED",
  ).length;
  return {
    text:
      application.status === "APPROVED" ? `${count}종 확인` : `${count}종 제출`,
    alert: false,
  };
}

export function ReviewListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<DriverStatus>("PENDING");
  const [search, setSearch] = useState("");
  const keyword = useDebounced(search.trim());
  const list = useInfiniteQuery({
    queryKey: ["review", "list", status, keyword],
    queryFn: ({ pageParam }) => reviewApi.list(status, keyword, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    placeholderData: keepPreviousData,
  });
  const first = list.data?.pages[0];
  const rows = list.data?.pages.flatMap((page) => page.items) ?? [];
  const counts = first?.counts;

  return (
    <>
      <PageTitle
        title="기사 심사"
        sub="기사 앱에서 가입을 신청한 기사님의 정보와 서류를 확인해요"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="심사 상태"
          value={status}
          onChange={setStatus}
          items={[
            { key: "PENDING", label: "심사 대기", count: counts?.PENDING ?? 0 },
            { key: "APPROVED", label: "승인", count: counts?.APPROVED ?? 0 },
            { key: "REJECTED", label: "반려", count: counts?.REJECTED ?? 0 },
          ]}
        />
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="이름, 휴대폰, 차량번호"
          className="w-[300px] max-w-full"
        />
      </div>
      <TableCard minWidth={900}>
        <TableHead columns={COLUMNS}>
          <span>신청자</span>
          <span>휴대폰</span>
          <span>차량</span>
          <span>신청일</span>
          <span>서류</span>
          <span>상태</span>
        </TableHead>
        {rows.map((row) => {
          const documents = documentsSummary(row);
          return (
            <TableRow
              key={row.id}
              columns={COLUMNS}
              onClick={() => navigate(`/review/${row.id}`)}
              className="min-h-[66px] py-3"
            >
              <div className="flex min-w-0 flex-col gap-[3px]">
                <span className="flex items-center gap-1.5 text-[15px] font-extrabold">
                  {row.applicant?.name ?? "탈퇴한 회원"}
                  {row.resubmitted && (
                    <span className="rounded-md bg-ink px-1.5 py-[3px] text-[11px] font-extrabold text-lime">
                      재신청
                    </span>
                  )}
                </span>
                <span className="truncate text-[12px] font-semibold text-muted">
                  {row.applicant?.email}
                </span>
              </div>
              <span className="tnum">{phone(row.applicant?.phone ?? "")}</span>
              <div className="flex flex-col gap-[3px]">
                <span className="font-bold">
                  {vehicleLabel(row.vehicleType)}
                </span>
                <span className="text-[12px] text-muted">
                  {plate(row.vehicleNumber)}
                </span>
              </div>
              <span className="tnum text-body">
                {shortDateTime(row.appliedAt)}
              </span>
              <span
                className={`text-[13px] font-bold ${
                  documents.alert ? "text-danger" : "text-body"
                }`}
              >
                {documents.text}
              </span>
              <div>
                <Chip kind={row.status} />
              </div>
            </TableRow>
          );
        })}
        <ListState
          loading={list.isPending}
          error={list.isError}
          empty={rows.length === 0}
          onRetry={() => list.refetch()}
          emptyText={
            keyword
              ? "찾는 신청자가 없어요"
              : status === "PENDING"
                ? "심사를 기다리는 신청이 없어요"
                : "아직 없어요"
          }
        />
      </TableCard>
      <LoadMore
        shown={rows.length}
        total={first?.total ?? 0}
        loading={list.isFetchingNextPage}
        onMore={() => list.fetchNextPage()}
      />
      <span className="text-[13px] font-semibold text-muted">
        {status === "PENDING"
          ? "심사 대기는 먼저 신청한 순서로 보여요"
          : "최근에 처리한 순서로 보여요"}
      </span>
    </>
  );
}
