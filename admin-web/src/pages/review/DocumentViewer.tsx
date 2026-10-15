import { useEffect, useRef } from "react";
import type { DriverApplication } from "../../api/types";
import { Chip } from "../../ui/chip";
import { documentLabel, fileKind } from "../../ui/format";
import {
  ChevronLeftLargeIcon,
  ChevronRightLargeIcon,
  DownloadIcon,
  ImageLargeIcon,
  PdfLargeIcon,
} from "../../ui/icons";
import { CloseButton, useDialogFocus } from "../../ui/kit";
import { documentChip, documentMeta, useDocumentFile } from "./documents";

const EXTENSIONS: Record<string, string> = {
  JPG: "jpg",
  PNG: "png",
  WEBP: "webp",
  HEIC: "heic",
  PDF: "pdf",
};

/** 서류를 화면 가득 크게 본다. 좌우 화살표 키로 다음 서류로 넘긴다. */
export function DocumentViewer({
  application,
  index,
  onChange,
  onClose,
}: {
  application: DriverApplication;
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useDialogFocus(panel, onClose);
  const count = application.documents.length;
  const document = application.documents[index];
  const file = useDocumentFile(application.id, document);
  const name = documentLabel(document.type);
  const kind = fileKind(document.contentType);
  const step = (by: number) => onChange((index + by + count) % count);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        onChange((index + 1) % count);
      } else if (event.key === "ArrowLeft") {
        onChange((index + count - 1) % count);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, onChange]);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} 크게 보기`}
      tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col gap-4 bg-[rgba(18,18,18,.92)] px-6 pt-5 pb-6 text-white outline-none"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex flex-wrap items-center gap-2.5"
      >
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-bold text-nav">
            {application.applicant?.name ?? "탈퇴한 회원"} · {index + 1} /{" "}
            {count}
          </span>
          <span className="flex items-center gap-2.5 text-[20px] font-extrabold">
            {name}
            <Chip kind={documentChip(document)} />
          </span>
        </div>
        {file.url && (
          <a
            href={file.url}
            download={`${application.applicant?.name ?? "driver"}-${name}.${EXTENSIONS[kind] ?? "bin"}`}
            className="ring-night flex h-10 items-center gap-2 rounded-xl px-3.5 text-[14px] font-bold"
          >
            <DownloadIcon />
            원본 내려받기
          </a>
        )}
        <CloseButton onClick={onClose} dark large />
      </div>
      <div className="flex min-h-0 flex-1 items-center gap-3.5">
        <StepButton label="이전 서류" onClick={() => step(-1)}>
          <ChevronLeftLargeIcon />
        </StepButton>
        <div
          onClick={(event) => event.stopPropagation()}
          className="stripes-lg my-auto flex max-h-[680px] flex-1 flex-col items-center justify-center gap-3 self-stretch overflow-hidden rounded-[18px] text-muted"
        >
          {file.url && file.isImage ? (
            <img
              src={file.url}
              alt={`${name} 사진`}
              className="size-full object-contain"
            />
          ) : file.url && kind === "PDF" ? (
            <iframe
              src={file.url}
              title={name}
              className="size-full bg-white"
            />
          ) : (
            <>
              {file.isImage ? <ImageLargeIcon /> : <PdfLargeIcon />}
              <span className="text-[16px] font-extrabold text-body">
                {document.status === "NOT_SUBMITTED"
                  ? "올리지 않은 서류예요"
                  : "불러오는 중이에요"}
              </span>
              <span className="font-mono text-[12px] font-semibold">
                {documentMeta(document)}
              </span>
            </>
          )}
        </div>
        <StepButton label="다음 서류" onClick={() => step(1)}>
          <ChevronRightLargeIcon />
        </StepButton>
      </div>
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex flex-wrap justify-center gap-2"
      >
        {application.documents.map((each, at) => (
          <button
            key={each.type}
            type="button"
            onClick={() => onChange(at)}
            aria-current={at === index}
            className={`h-[38px] rounded-xl px-3.5 text-[13px] font-bold ${
              at === index ? "bg-white text-ink" : "bg-night text-line"
            }`}
          >
            {documentLabel(each.type)}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex size-12 flex-none items-center justify-center rounded-full bg-night"
    >
      {children}
    </button>
  );
}
