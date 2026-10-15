import { useState } from "react";
import type { DocumentType, DriverApplication } from "../../api/types";
import { documentLabel, shortId } from "../../ui/format";
import { CheckIcon } from "../../ui/icons";
import { ActionButton, FormError, Modal, ModalHeader } from "../../ui/kit";
import { documentMeta } from "./documents";

/** 자주 쓰는 반려 사유. 누르면 사유 칸에 덧붙는다. */
const QUICK_REASONS = [
  "사진이 흐려 글자를 읽을 수 없어요.",
  "서류의 유효기간이 지났어요.",
  "신청 정보와 서류 내용이 달라요.",
  "서류 일부가 잘려 있어요.",
];
const MAX_REASON = 300;

export function RejectModal({
  application,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  application: DriverApplication;
  busy: boolean;
  error: string | null;
  onSubmit: (reason: string, documents: DocumentType[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<DocumentType[]>([]);
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);

  function submit() {
    if (picked.length === 0) {
      setInvalid("반려할 서류를 하나 이상 골라 주세요");
    } else if (reason.trim().length < 5) {
      setInvalid("반려 사유를 적어 주세요");
    } else {
      onSubmit(reason.trim(), picked);
    }
  }

  return (
    <Modal label="가입 반려" width={540} gap={22} onClose={onClose}>
      <ModalHeader
        title="가입 반려"
        sub={`${application.applicant?.name ?? "탈퇴한 회원"} · ${shortId(application.id)}`}
        onClose={onClose}
      />
      <div className="flex flex-col gap-2.5">
        <span className="text-[14px] font-extrabold">반려할 서류</span>
        {application.documents.map((document) => {
          const on = picked.includes(document.type);
          return (
            <button
              key={document.type}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => {
                setInvalid(null);
                setPicked(
                  on
                    ? picked.filter((type) => type !== document.type)
                    : [...picked, document.type],
                );
              }}
              className={`flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left ${
                on ? "ring-ink" : "ring-line"
              }`}
            >
              <span
                className={`flex size-[22px] flex-none items-center justify-center rounded-[7px] ${
                  on
                    ? "bg-ink text-white"
                    : "ring-box bg-white text-transparent"
                }`}
              >
                <CheckIcon />
              </span>
              <span className="flex-1 text-[15px] font-bold">
                {documentLabel(document.type)}
              </span>
              <span className="text-[12px] font-semibold text-muted">
                {documentMeta(document)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="text-[14px] font-extrabold">반려 사유</span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => {
                setInvalid(null);
                setReason((current) =>
                  `${current.trim()} ${text}`.trim().slice(0, MAX_REASON),
                );
              }}
              className="h-8 rounded-[10px] bg-hair px-[11px] text-[13px] font-bold"
            >
              {text.replace(/\.$/, "")}
            </button>
          ))}
        </div>
        <label className="field gap-1.5 rounded-[14px] px-3.5 py-3">
          <textarea
            value={reason}
            onChange={(event) => {
              setInvalid(null);
              setReason(event.target.value);
            }}
            rows={4}
            maxLength={MAX_REASON}
            aria-label="반려 사유"
            placeholder="기사님이 무엇을 고쳐 다시 올려야 하는지 적어 주세요"
            className="text-[15px] leading-[1.6] font-medium"
          />
          <span className="tnum self-end text-[12px] font-semibold text-faint">
            {reason.length}/{MAX_REASON}
          </span>
        </label>
        <span className="text-[13px] font-semibold text-muted">
          기사 앱의 심사 결과 화면에 이 사유가 그대로 보여요
        </span>
      </div>
      <FormError message={invalid ?? error} />
      <div className="flex justify-end gap-2">
        <ActionButton tone="soft" onClick={onClose}>
          취소
        </ActionButton>
        <ActionButton tone="danger" disabled={busy} onClick={submit}>
          반려하기
        </ActionButton>
      </div>
    </Modal>
  );
}
