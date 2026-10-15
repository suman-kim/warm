import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { membersApi } from "../../api/admin";
import type { Member, MemberRole } from "../../api/types";
import { Chip } from "../../ui/chip";
import { date, monthDay, phone, shortDateTime } from "../../ui/format";
import { nextPage, useDebounced } from "../../ui/hooks";
import {
  ListState,
  LoadMore,
  OutlineTabs,
  PageTitle,
  SearchField,
  TableCard,
  TableHead,
  TableRow,
  Tabs,
} from "../../ui/kit";
import { MemberDrawer } from "./MemberDrawer";

const COLUMNS = "minmax(210px,1.4fr) 130px 100px 120px 130px 130px";

type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED";

/** 정지가 언제까지인지 — '무기한' 또는 '~10.20'. 정지 중이 아니면 빈 글. */
export function suspendedUntilShort(member: Member): string {
  if (!member.suspended) {
    return "";
  }
  return member.suspendedUntil
    ? `~${monthDay(member.suspendedUntil)}`
    : "무기한";
}

export function MembersPage() {
  const [role, setRole] = useState<MemberRole>("CUSTOMER");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const keyword = useDebounced(search.trim());
  const list = useInfiniteQuery({
    queryKey: ["members", "list", role, status, keyword],
    queryFn: ({ pageParam }) =>
      membersApi.list(
        role,
        keyword,
        status === "ALL" ? undefined : status,
        pageParam,
      ),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    placeholderData: keepPreviousData,
  });
  const first = list.data?.pages[0];
  const rows = list.data?.pages.flatMap((page) => page.items) ?? [];
  const isDriver = role === "DRIVER";

  return (
    <>
      <PageTitle
        title="회원"
        sub="고객과 기사 계정을 찾아보고, 필요하면 정지해요"
      />
      <div className="flex flex-wrap items-center gap-2.5">
        <Tabs
          label="회원 종류"
          value={role}
          onChange={setRole}
          items={[
            {
              key: "CUSTOMER",
              label: "고객",
              count: first?.counts.CUSTOMER ?? 0,
            },
            { key: "DRIVER", label: "기사", count: first?.counts.DRIVER ?? 0 },
          ]}
        />
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="이름, 이메일, 휴대폰 번호"
          className="max-w-[360px] flex-[1_1_240px]"
        />
        <div className="ml-auto">
          <OutlineTabs
            label="계정 상태"
            value={status}
            onChange={setStatus}
            items={[
              { key: "ALL", label: "전체" },
              { key: "ACTIVE", label: "정상" },
              { key: "SUSPENDED", label: "정지" },
            ]}
          />
        </div>
      </div>
      <TableCard minWidth={880}>
        <TableHead columns={COLUMNS}>
          <span>이름</span>
          <span>휴대폰</span>
          <span>가입일</span>
          <span>{isDriver ? "운행" : "주문"}</span>
          <span>{isDriver ? "최근 운행" : "최근 이용"}</span>
          <span>상태</span>
        </TableHead>
        {rows.map((member) => (
          <TableRow
            key={member.id}
            columns={COLUMNS}
            onClick={() => setOpenId(member.id)}
            className="min-h-16 py-3"
          >
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-[15px] font-extrabold">{member.name}</span>
              <span className="truncate text-[12px] font-semibold text-muted">
                {member.email}
              </span>
            </div>
            <span className="tnum">{phone(member.phone)}</span>
            <span className="tnum text-body">{date(member.joinedAt)}</span>
            <span className="tnum">{usageText(member)}</span>
            <span className="tnum text-body">
              {member.lastUsedAt ? shortDateTime(member.lastUsedAt) : "—"}
            </span>
            <div className="flex items-center gap-2">
              <Chip
                kind={member.suspended ? "MEMBER_SUSPENDED" : "MEMBER_ACTIVE"}
              />
              <span className="text-[12px] font-bold text-danger">
                {suspendedUntilShort(member)}
              </span>
            </div>
          </TableRow>
        ))}
        <ListState
          loading={list.isPending}
          error={list.isError}
          empty={rows.length === 0}
          emptyText="찾는 회원이 없어요. 이름이나 휴대폰 번호를 다시 확인해 주세요."
          onRetry={() => list.refetch()}
        />
      </TableCard>
      <LoadMore
        shown={rows.length}
        total={first?.total ?? 0}
        loading={list.isFetchingNextPage}
        onMore={() => list.fetchNextPage()}
      />
      {openId && <MemberDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

/** 23건 또는 214건 · ★ 4.9 */
function usageText(member: Member): string {
  const count = `${member.useCount}건`;
  return member.role === "DRIVER" && member.rating !== null
    ? `${count} · ★ ${member.rating.toFixed(1)}`
    : count;
}
