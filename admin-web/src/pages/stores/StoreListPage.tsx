import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { storesApi } from "../../api/admin";
import type { StoreStatus } from "../../api/types";
import { Chip } from "../../ui/chip";
import { businessNumber, shortDateTime } from "../../ui/format";
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
  "minmax(150px,1.1fr) 140px minmax(220px,1.6fr) 110px 110px 100px";

/** 가게 심사 목록. 가게 앱에서 등록을 신청한 가게를 심사 상태별로 본다. */
export function StoreListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StoreStatus>("PENDING");
  const [search, setSearch] = useState("");
  const keyword = useDebounced(search.trim());
  const list = useInfiniteQuery({
    queryKey: ["stores", "list", status, keyword],
    queryFn: ({ pageParam }) => storesApi.list(status, keyword, pageParam),
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
        title="가게 심사"
        sub="가게 앱에서 등록을 신청한 가게를 확인해요. 승인하면 바로 배달을 요청할 수 있어요"
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
          placeholder="상호, 사업자등록번호"
          className="w-[300px] max-w-full"
        />
      </div>
      <TableCard minWidth={860}>
        <TableHead columns={COLUMNS}>
          <span>상호</span>
          <span>사업자등록번호</span>
          <span>가게 주소</span>
          <span>사장님</span>
          <span>신청</span>
          <span>상태</span>
        </TableHead>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            columns={COLUMNS}
            onClick={() => navigate(`/stores/${row.id}`)}
          >
            <span className="truncate text-[15px] font-extrabold">
              {row.name}
            </span>
            <span className="tnum">{businessNumber(row.businessNumber)}</span>
            <span className="truncate text-body">
              {[row.address.address, row.address.detailAddress]
                .filter(Boolean)
                .join(" ")}
            </span>
            <span className="font-bold">{row.ownerName ?? "탈퇴한 회원"}</span>
            <span className="tnum text-body">
              {shortDateTime(row.appliedAt)}
            </span>
            <div>
              <Chip kind={row.status} />
            </div>
          </TableRow>
        ))}
        <ListState
          loading={list.isPending}
          error={list.isError}
          empty={rows.length === 0}
          onRetry={() => list.refetch()}
          emptyText={
            keyword
              ? "찾는 가게가 없어요"
              : status === "PENDING"
                ? "심사를 기다리는 가게가 없어요"
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
    </>
  );
}
