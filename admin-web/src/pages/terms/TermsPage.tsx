import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { legalApi } from "../../api/admin";
import { errorMessage } from "../../api/client";
import type { LegalDocument, LegalType } from "../../api/types";
import { Chip } from "../../ui/chip";
import {
  addDays,
  date,
  dotted,
  kstMidnight,
  monthDay,
  todayKst,
} from "../../ui/format";
import { PlusIcon } from "../../ui/icons";
import {
  ActionButton,
  FormError,
  HeaderButton,
  Modal,
  ModalHeader,
  PageTitle,
  TableCard,
  TableHead,
  TableNote,
  TableRow,
} from "../../ui/kit";
import { useToast } from "../../ui/toast";

const COLUMNS = "56px 110px 110px 80px minmax(90px,1fr)";

/** 약관의 종류. [audience]는 이 약관을 보는 앱이다. */
const TYPES: { type: LegalType; name: string; audience: string }[] = [
  { type: "TERMS", name: "서비스 이용약관", audience: "가게·라이더" },
  { type: "REFUND", name: "취소·환불 규정", audience: "가게·라이더" },
  { type: "PRIVACY", name: "개인정보 처리방침", audience: "가게·라이더" },
  {
    type: "LOCATION",
    name: "위치기반서비스 이용약관",
    audience: "가게·라이더",
  },
  { type: "DRIVER", name: "라이더 이용약관", audience: "라이더" },
  { type: "MARKETING", name: "마케팅 정보 수신 동의", audience: "가게·라이더" },
];

/** 판 번호를 숫자로. 숫자가 아닌 예전 판은 0으로 본다 (서버와 같다). */
function versionNumber(document: LegalDocument): number {
  return /^\d+$/.test(document.version) ? Number(document.version) : 0;
}

export function TermsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState<LegalType>("TERMS");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const all = useQuery({ queryKey: ["terms"], queryFn: legalApi.list });
  const documents = all.data ?? [];
  const versionsOf = (of: LegalType) =>
    documents
      .filter((document) => document.type === of)
      .sort((a, b) => versionNumber(b) - versionNumber(a));
  const versions = versionsOf(type);
  const selected =
    versions.find((document) => document.id === selectedId) ??
    versions.find((document) => document.status === "CURRENT") ??
    versions[0];
  const current = TYPES.find((each) => each.type === type)!;
  const publish = useMutation({
    mutationFn: legalApi.publish,
    onSuccess: async (document) => {
      await queryClient.invalidateQueries({ queryKey: ["terms"] });
      setType(document.type);
      setSelectedId(document.id);
      setWriting(false);
      toast(
        document.status === "CURRENT"
          ? `v${document.version}을 올렸어요. 지금부터 시행돼요`
          : `v${document.version}을 올렸어요. ${date(document.effectiveAt)}부터 시행돼요`,
      );
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="약관·정책"
          sub="새 판을 올리면 시행일부터 앱에 적용되고, 이전 판은 기록으로 남아요"
        />
        <HeaderButton
          onClick={() => {
            publish.reset();
            setWriting(true);
          }}
        >
          <PlusIcon />새 판 올리기
        </HeaderButton>
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <div
          role="tablist"
          aria-label="약관 종류"
          className="flex max-w-[320px] flex-[1_1_260px] flex-col gap-0.5 rounded-[20px] bg-white p-1.5"
        >
          {TYPES.map((each) => {
            const on = each.type === type;
            const list = versionsOf(each.type);
            const live = list.find((document) => document.status === "CURRENT");
            const next = list.find(
              (document) => document.status === "SCHEDULED",
            );
            return (
              <button
                key={each.type}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setType(each.type);
                  setSelectedId(null);
                }}
                className={`flex w-full flex-col gap-[5px] rounded-[15px] p-3.5 text-left ${
                  on ? "bg-ink text-white" : "text-ink"
                }`}
              >
                <span className="text-[15px] font-extrabold">{each.name}</span>
                <span
                  className={`text-[12px] font-semibold ${
                    on ? "text-dim" : "text-muted"
                  }`}
                >
                  {live ? `v${live.version} 시행 중` : "시행 중인 판 없음"}
                  {next &&
                    ` · v${next.version} ${monthDay(next.effectiveAt)} 시행 예정`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3.5">
          <TableCard minWidth={560}>
            <div className="flex items-center gap-2.5 px-[22px] pt-5 pb-2">
              <span className="text-[18px] font-extrabold tracking-[-0.02em]">
                {current.name}
              </span>
              <span className="rounded-[7px] bg-hair px-2 py-1 text-[12px] font-bold text-sub">
                {current.audience}
              </span>
            </div>
            <TableHead columns={COLUMNS} height={42}>
              <span>판</span>
              <span>시행일</span>
              <span>등록일</span>
              <span>등록자</span>
              <span>상태</span>
            </TableHead>
            {versions.map((document) => {
              const on = document.id === selected?.id;
              return (
                <TableRow
                  key={document.id}
                  columns={COLUMNS}
                  onClick={() => setSelectedId(document.id)}
                  className={`h-[54px] ${on ? "bg-paper" : ""}`}
                  style={
                    on ? { boxShadow: "inset 3px 0 0 #121212" } : undefined
                  }
                >
                  <span className="text-[15px] font-extrabold">
                    v{document.version}
                  </span>
                  <span className="tnum">{date(document.effectiveAt)}</span>
                  <span className="tnum text-body">
                    {date(document.createdAt)}
                  </span>
                  <span className="truncate text-body">
                    {document.createdByName ?? "—"}
                  </span>
                  <div>
                    <Chip kind={document.status} />
                  </div>
                </TableRow>
              );
            })}
            {versions.length === 0 && (
              <TableNote
                onRetry={all.isError ? () => all.refetch() : undefined}
              >
                {all.isPending
                  ? "불러오는 중이에요"
                  : all.isError
                    ? "불러오지 못했어요"
                    : "아직 올린 판이 없어요. 앱의 약관 화면에 이 문서가 보이지 않아요."}
              </TableNote>
            )}
          </TableCard>
          {selected && (
            <div className="flex flex-col gap-3.5 rounded-[20px] bg-white px-[22px] pt-5 pb-[22px]">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[16px] font-extrabold">
                  v{selected.version} 본문
                </span>
                <Chip kind={selected.status} />
                <span className="text-[13px] font-semibold text-muted">
                  {date(selected.effectiveAt)} 시행 · {date(selected.createdAt)}{" "}
                  {selected.createdByName} 등록
                </span>
              </div>
              <div className="max-h-[420px] overflow-auto rounded-[14px] bg-paper px-5 py-[18px] text-[14px] leading-[1.75] font-medium whitespace-pre-wrap text-body">
                {selected.body}
              </div>
            </div>
          )}
        </div>
      </div>
      {writing && (
        <WriteModal
          initialType={type}
          documents={documents}
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
  initialType,
  documents,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  initialType: LegalType;
  documents: LegalDocument[];
  busy: boolean;
  error: string | null;
  onSubmit: (input: {
    type: LegalType;
    version: string;
    title: string;
    body: string;
    effectiveAt: string;
  }) => void;
  onClose: () => void;
}) {
  const today = todayKst();
  const latestOf = (of: LegalType) =>
    documents
      .filter((document) => document.type === of)
      .sort((a, b) => versionNumber(b) - versionNumber(a))[0];
  const nextVersion = (of: LegalType) => {
    const latest = latestOf(of);
    return String((latest ? versionNumber(latest) : 0) + 1);
  };
  const [type, setType] = useState(initialType);
  const [version, setVersion] = useState(nextVersion(initialType));
  const [effective, setEffective] = useState(addDays(today, 7));
  const [body, setBody] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const latest = latestOf(type);
  const latestNumber = latest ? versionNumber(latest) : 0;
  // 지금 보이는 판이 없는 종류는 오늘부터 시행할 수 있다 — 바꾸는 것이 아니라 처음 올리는 것이다.
  const hasCurrent = documents.some(
    (document) => document.type === type && document.status === "CURRENT",
  );

  function submit() {
    if (!(Number(version) > latestNumber)) {
      setInvalid(`판 번호는 v${latestNumber + 1} 이상이어야 해요`);
    } else if (!effective) {
      setInvalid("시행일을 골라 주세요");
    } else if (hasCurrent ? effective <= today : effective < today) {
      setInvalid(
        hasCurrent
          ? "시행일은 내일 이후로 정해 주세요"
          : "시행일은 오늘 이후로 정해 주세요",
      );
    } else if (body.trim().length < 10) {
      setInvalid("본문을 적어 주세요");
    } else {
      onSubmit({
        type,
        version,
        title: TYPES.find((each) => each.type === type)!.name,
        body: body.trim(),
        effectiveAt: kstMidnight(effective),
      });
    }
  }

  return (
    <Modal label="새 판 올리기" width={680} onClose={onClose}>
      <ModalHeader title="새 판 올리기" onClose={onClose} />
      <div className="flex flex-col gap-2.5">
        <span className="text-[14px] font-extrabold">종류</span>
        <div
          role="radiogroup"
          aria-label="종류"
          className="flex flex-wrap gap-1.5"
        >
          {TYPES.map((each) => {
            const on = each.type === type;
            return (
              <button
                key={each.type}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setInvalid(null);
                  setType(each.type);
                  setVersion(nextVersion(each.type));
                }}
                className={`h-[38px] rounded-xl px-[13px] text-[14px] font-bold ${
                  on ? "bg-ink text-white" : "ring-line bg-white text-ink"
                }`}
              >
                {each.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        <label className="field gap-1 rounded-[14px] px-3.5 py-2.5">
          <span className="text-[12px] font-bold text-muted">판 번호</span>
          <span className="flex items-baseline gap-0.5 text-[16px] font-bold">
            <span>v</span>
            <input
              value={version}
              onChange={(event) => {
                setInvalid(null);
                setVersion(event.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              inputMode="numeric"
              className="text-[16px] font-bold"
            />
          </span>
        </label>
        <label className="field gap-1 rounded-[14px] px-3.5 py-2.5">
          <span className="text-[12px] font-bold text-muted">시행일</span>
          <input
            type="date"
            value={effective}
            min={hasCurrent ? addDays(today, 1) : today}
            onChange={(event) => {
              setInvalid(null);
              setEffective(event.target.value);
            }}
            className="text-[16px] font-bold"
          />
        </label>
      </div>
      <span className="-mt-2.5 text-[13px] font-semibold text-muted">
        {latest
          ? `지금 마지막 판은 v${latest.version}이에요. `
          : "아직 올린 판이 없어요. "}
        시행일 0시부터 앱에 새 판이 적용되고, 그 전까지는 시행 예정으로 보여요.
      </span>
      <label className="field gap-1.5 rounded-[14px] px-3.5 py-2.5">
        <span className="text-[12px] font-bold text-muted">본문</span>
        <textarea
          value={body}
          onChange={(event) => {
            setInvalid(null);
            setBody(event.target.value);
          }}
          rows={10}
          placeholder={"제1조 (목적)\n…"}
          className="text-[14px] leading-[1.7] font-medium"
        />
      </label>
      {latest && (
        <button
          type="button"
          onClick={() => {
            setInvalid(null);
            setBody(latest.body);
          }}
          className="-mt-2 h-[34px] self-start rounded-[10px] bg-hair px-3 text-[13px] font-bold"
        >
          v{latest.version} 본문 불러오기
        </button>
      )}
      <FormError message={invalid ?? error} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-muted">
          {effective && `${dotted(effective)} 0시부터 시행`}
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
