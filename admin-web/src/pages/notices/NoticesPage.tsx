import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { noticesApi } from "../../api/admin";
import { errorMessage } from "../../api/client";
import type { Notice, NoticeAudience } from "../../api/types";
import { audienceApps, audienceLabel, AudienceTag, Chip } from "../../ui/chip";
import { date, dateTime, monthDay } from "../../ui/format";
import { nextPage } from "../../ui/hooks";
import { PlusIcon } from "../../ui/icons";
import {
  ActionButton,
  CloseButton,
  ConfirmModal,
  FormError,
  HeaderButton,
  ListState,
  LoadMore,
  Modal,
  ModalHeader,
  PageTitle,
  TableCard,
  TableHead,
  TableRow,
  Tabs,
} from "../../ui/kit";
import { useToast } from "../../ui/toast";

const COLUMNS = "minmax(260px,1fr) 72px 100px 72px 104px";
const AUDIENCES: NoticeAudience[] = ["ALL", "CUSTOMER", "DRIVER"];
const MAX_TITLE = 40;

export function NoticesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [state, setState] = useState<"LIVE" | "REMOVED">("LIVE");
  const [viewing, setViewing] = useState<Notice | null>(null);
  const [removing, setRemoving] = useState<Notice | null>(null);
  const [writing, setWriting] = useState(false);
  const list = useInfiniteQuery({
    queryKey: ["notices", state],
    queryFn: ({ pageParam }) => noticesApi.list(state, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    placeholderData: keepPreviousData,
  });
  const first = list.data?.pages[0];
  const rows = list.data?.pages.flatMap((page) => page.items) ?? [];
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["notices"] });
  const remove = useMutation({
    mutationFn: (notice: Notice) => noticesApi.remove(notice.id),
    onSuccess: () => {
      void refresh();
      setRemoving(null);
      setViewing(null);
      toast("공지를 내렸어요");
    },
  });
  const publish = useMutation({
    mutationFn: noticesApi.publish,
    onSuccess: (notice) => {
      void refresh();
      setWriting(false);
      setState("LIVE");
      toast(`${audienceApps(notice.audience)}에 공지를 올렸어요`);
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="공지사항"
          sub="올린 공지는 대상 앱의 공지사항에 바로 보여요"
        />
        <HeaderButton
          onClick={() => {
            publish.reset();
            setWriting(true);
          }}
        >
          <PlusIcon />
          공지 올리기
        </HeaderButton>
      </div>
      <Tabs
        label="공지 상태"
        className="self-start"
        value={state}
        onChange={setState}
        items={[
          { key: "LIVE", label: "게시 중", count: first?.counts.live ?? 0 },
          {
            key: "REMOVED",
            label: "내린 공지",
            count: first?.counts.removed ?? 0,
          },
        ]}
      />
      <TableCard minWidth={760}>
        <TableHead columns={COLUMNS}>
          <span>제목</span>
          <span>대상</span>
          <span>게시일</span>
          <span>게시자</span>
          <span />
        </TableHead>
        {rows.map((notice) => (
          <TableRow
            key={notice.id}
            columns={COLUMNS}
            onClick={() => setViewing(notice)}
            className="min-h-[66px] py-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[15px] font-extrabold">{notice.title}</span>
              <span className="truncate text-[13px] font-semibold text-muted">
                {notice.body.split("\n")[0]}
              </span>
            </div>
            <div>
              <AudienceTag audience={notice.audience} />
            </div>
            <span className="tnum text-body">{date(notice.publishedAt)}</span>
            <span className="truncate text-body">
              {notice.authorName ?? "—"}
            </span>
            <div className="flex justify-end">
              {notice.removedAt ? (
                <span className="tnum text-[12px] font-bold text-muted">
                  내림 · {monthDay(notice.removedAt)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    remove.reset();
                    setRemoving(notice);
                  }}
                  className="ring-line h-8 rounded-[10px] bg-white px-3 text-[13px] font-bold"
                >
                  내리기
                </button>
              )}
            </div>
          </TableRow>
        ))}
        <ListState
          loading={list.isPending}
          error={list.isError}
          empty={rows.length === 0}
          emptyText={
            state === "LIVE" ? "게시 중인 공지가 없어요" : "내린 공지가 없어요"
          }
          onRetry={() => list.refetch()}
        />
      </TableCard>
      <LoadMore
        shown={rows.length}
        total={first?.total ?? 0}
        loading={list.isFetchingNextPage}
        onMore={() => list.fetchNextPage()}
      />

      {viewing && (
        <Modal
          label={viewing.title}
          width={560}
          gap={18}
          onClose={() => setViewing(null)}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <AudienceTag audience={viewing.audience} />
              <Chip kind={viewing.removedAt ? "REMOVED" : "LIVE"} />
            </div>
            <CloseButton onClick={() => setViewing(null)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[21px] leading-[1.35] font-extrabold tracking-[-0.02em]">
              {viewing.title}
            </span>
            <span className="text-[13px] font-semibold text-muted">
              {[
                dateTime(viewing.publishedAt),
                viewing.authorName,
                viewing.removedAt && `${dateTime(viewing.removedAt)} 내림`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <div className="rounded-2xl bg-paper px-5 py-[18px] text-[15px] leading-[1.7] font-medium whitespace-pre-wrap text-body">
            {viewing.body}
          </div>
          {!viewing.removedAt && (
            <div className="flex justify-end gap-2">
              <ActionButton
                tone="outline"
                onClick={() => {
                  remove.reset();
                  setRemoving(viewing);
                }}
              >
                공지 내리기
              </ActionButton>
              <ActionButton onClick={() => setViewing(null)}>닫기</ActionButton>
            </div>
          )}
        </Modal>
      )}
      {removing && (
        <ConfirmModal
          title="이 공지를 내릴까요?"
          body={`‘${removing.title}’ 공지가 ${audienceApps(removing.audience)}에서 바로 사라져요. 내린 공지는 기록으로 남아요.`}
          confirm="내리기"
          busy={remove.isPending}
          error={remove.isError ? errorMessage(remove.error) : null}
          onConfirm={() => remove.mutate(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
      {writing && (
        <WriteModal
          busy={publish.isPending}
          error={publish.isError ? errorMessage(publish.error) : null}
          onSubmit={(input) => publish.mutate(input)}
          onClose={() => setWriting(false)}
        />
      )}
    </>
  );
}

function WriteModal({
  busy,
  error,
  onSubmit,
  onClose,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (input: {
    audience: NoticeAudience;
    title: string;
    body: string;
  }) => void;
  onClose: () => void;
}) {
  const [audience, setAudience] = useState<NoticeAudience>("ALL");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);

  function submit() {
    if (title.trim().length < 2) {
      setInvalid("제목을 적어 주세요");
    } else if (body.trim().length < 5) {
      setInvalid("본문을 적어 주세요");
    } else {
      onSubmit({ audience, title: title.trim(), body: body.trim() });
    }
  }

  return (
    <Modal label="공지 올리기" width={580} onClose={onClose}>
      <ModalHeader title="공지 올리기" onClose={onClose} />
      <div className="flex flex-col gap-2.5">
        <span className="text-[14px] font-extrabold">대상</span>
        <div
          role="radiogroup"
          aria-label="대상"
          className="grid grid-cols-3 gap-2"
        >
          {AUDIENCES.map((each) => {
            const on = each === audience;
            return (
              <button
                key={each}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setAudience(each)}
                className={`flex flex-col gap-[3px] rounded-[14px] px-3.5 py-3 text-left ${
                  on ? "ring-ink-2 bg-paper" : "ring-line bg-white"
                }`}
              >
                <span className="text-[15px] font-extrabold">
                  {audienceLabel(each)}
                </span>
                <span className="text-[12px] font-semibold text-muted">
                  {audienceApps(each)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <label className="field gap-1 rounded-[14px] px-3.5 py-2.5">
        <span className="flex justify-between text-[12px] font-bold text-muted">
          <span>제목</span>
          <span className="tnum">
            {title.length}/{MAX_TITLE}
          </span>
        </span>
        <input
          value={title}
          onChange={(event) => {
            setInvalid(null);
            setTitle(event.target.value);
          }}
          maxLength={MAX_TITLE}
          placeholder="앱의 공지사항 목록에 보이는 제목"
          className="text-[16px] font-bold"
        />
      </label>
      <label className="field gap-1.5 rounded-[14px] px-3.5 py-2.5">
        <span className="text-[12px] font-bold text-muted">본문</span>
        <textarea
          value={body}
          onChange={(event) => {
            setInvalid(null);
            setBody(event.target.value);
          }}
          rows={7}
          maxLength={5000}
          placeholder="공지 내용을 적어 주세요"
          className="text-[15px] leading-[1.6] font-medium"
        />
      </label>
      <FormError message={invalid ?? error} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-muted">
          올리면 바로 앱에 보여요
        </span>
        <div className="flex gap-2">
          <ActionButton tone="soft" onClick={onClose}>
            취소
          </ActionButton>
          <ActionButton disabled={busy} onClick={submit}>
            올리기
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}
