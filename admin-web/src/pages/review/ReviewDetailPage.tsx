import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { reviewApi } from "../../api/admin";
import { errorMessage } from "../../api/client";
import type {
  DocumentType,
  DriverApplication,
  DriverDocument,
} from "../../api/types";
import { Chip } from "../../ui/chip";
import {
  dateTime,
  documentLabel,
  fileKind,
  phone,
  plate,
  shortId,
  vehicleLabel,
} from "../../ui/format";
import {
  AlertIcon,
  BackIcon,
  CheckIcon,
  ExpandIcon,
  ImageIcon,
  PdfIcon,
} from "../../ui/icons";
import { ConfirmModal, TableNote } from "../../ui/kit";
import { useToast } from "../../ui/toast";
import { DocumentViewer } from "./DocumentViewer";
import { documentChip, documentMeta, useDocumentFile } from "./documents";
import { RejectModal } from "./RejectModal";

export function ReviewDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<"approve" | "reject" | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const detail = useQuery({
    queryKey: ["review", "detail", id],
    queryFn: () => reviewApi.detail(id),
  });
  /** 심사한 뒤: 받은 결과를 바로 보여 주고, 목록과 메뉴의 건수는 새로 받게 한다. */
  const settle = (application: DriverApplication, message: string) => {
    queryClient.setQueryData(["review", "detail", id], application);
    void queryClient.invalidateQueries({ queryKey: ["review", "list"] });
    void queryClient.invalidateQueries({
      queryKey: ["review", "pending-count"],
    });
    setModal(null);
    toast(message);
  };
  const approve = useMutation({
    mutationFn: () => reviewApi.approve(id),
    onSuccess: (application) =>
      settle(application, "승인했어요. 라이더 앱에 결과가 바로 보여요"),
  });
  const reject = useMutation({
    mutationFn: (input: { reason: string; documents: DocumentType[] }) =>
      reviewApi.reject(id, input.reason, input.documents),
    onSuccess: (application) =>
      settle(application, "반려했어요. 라이더님이 서류를 다시 올릴 수 있어요"),
  });

  const back = (
    <Link
      to="/review"
      className="-ml-1 flex h-8 items-center gap-1 self-start text-[14px] font-bold text-sub"
    >
      <BackIcon />
      라이더 심사
    </Link>
  );
  if (!detail.data) {
    return (
      <>
        {back}
        <div className="rounded-[20px] bg-white">
          <TableNote
            onRetry={detail.isError ? () => detail.refetch() : undefined}
          >
            {detail.isError ? errorMessage(detail.error) : "불러오는 중이에요"}
          </TableNote>
        </div>
      </>
    );
  }

  const application = detail.data;
  const name = application.applicant?.name ?? "탈퇴한 회원";
  const decided = [
    application.reviewedAt && dateTime(application.reviewedAt),
    application.reviewerName,
  ]
    .filter(Boolean)
    .join(" · ");
  const rejectedDocuments = application.documents
    .filter((document) => document.status === "REJECTED")
    .map((document) => documentLabel(document.type))
    .join(", ");

  return (
    <>
      {back}
      <div className="-mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.03em]">
              {name}
            </h1>
            <Chip kind={application.status} large />
          </div>
          <span className="text-[14px] font-semibold text-muted">
            {shortId(application.id)} · {dateTime(application.appliedAt)} 신청
          </span>
        </div>
        {application.status === "PENDING" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModal("reject")}
              className="ring-danger h-[46px] rounded-[14px] bg-white px-[22px] text-[15px] font-extrabold text-danger"
            >
              반려
            </button>
            <button
              type="button"
              onClick={() => setModal("approve")}
              className="h-[46px] rounded-[14px] bg-ink px-[26px] text-[15px] font-extrabold text-white"
            >
              승인
            </button>
          </div>
        )}
      </div>

      {application.resubmitted && (
        <div className="flex items-start gap-3.5 rounded-[18px] bg-ink px-5 py-4 text-white">
          <span className="mt-px text-lime">
            <AlertIcon />
          </span>
          <div className="flex flex-col gap-[5px]">
            <span className="text-[15px] font-extrabold">
              반려 후 서류를 다시 올려 신청했어요
            </span>
            <span className="text-[14px] leading-[1.5] font-semibold text-dim">
              이전 반려 사유 · {application.previousRejectionReason}
            </span>
          </div>
        </div>
      )}
      {application.status === "REJECTED" && (
        <div className="flex items-start gap-3.5 rounded-[18px] bg-danger-soft px-5 py-4">
          <span className="mt-px text-danger">
            <AlertIcon />
          </span>
          <div className="flex flex-col gap-[5px]">
            <span className="text-[13px] font-extrabold text-danger">
              반려 사유
            </span>
            <span className="text-[15px] leading-[1.5] font-bold">
              {application.rejectionReason}
            </span>
            <span className="text-[13px] font-semibold text-danger-deep">
              {[
                rejectedDocuments && `반려한 서류 · ${rejectedDocuments}`,
                decided,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>
      )}
      {application.status === "APPROVED" && (
        <div className="flex items-center gap-3.5 rounded-[18px] bg-ok-soft px-5 py-4">
          <span className="flex size-6 flex-none items-center justify-center rounded-full bg-ok text-white">
            <CheckIcon />
          </span>
          <div className="flex flex-col gap-[3px]">
            <span className="text-[15px] font-extrabold">
              승인했어요. 라이더 앱에서 운행을 시작할 수 있어요
            </span>
            <span className="text-[13px] font-semibold text-ok">{decided}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex max-w-[380px] flex-[1_1_300px] flex-col gap-3.5">
          <InfoCard
            title="신청자 정보"
            rows={[
              ["이름", name],
              ["휴대폰", phone(application.applicant?.phone ?? "")],
              ["이메일", application.applicant?.email ?? ""],
              ["신청일", dateTime(application.appliedAt)],
            ]}
          />
          <InfoCard
            title="차량"
            rows={[
              ["차종", vehicleLabel(application.vehicleType)],
              ["차량번호", plate(application.vehicleNumber)],
            ]}
          />
        </div>
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-[16px] font-extrabold">제출 서류</span>
            <span className="text-[13px] font-semibold text-muted">
              서류를 누르면 크게 볼 수 있어요
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
            {application.documents.map((document, index) => (
              <DocumentCard
                key={document.type}
                driverId={application.id}
                document={document}
                onOpen={() => setViewing(index)}
              />
            ))}
          </div>
        </div>
      </div>

      {viewing !== null && (
        <DocumentViewer
          application={application}
          index={viewing}
          onChange={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
      {modal === "approve" && (
        <ConfirmModal
          title={`${name} 님을 승인할까요?`}
          body="승인하면 라이더 앱에서 바로 운행을 시작할 수 있어요. 제출한 서류 3종은 모두 확인으로 바뀌어요."
          confirm="승인하기"
          busy={approve.isPending}
          error={approve.isError ? errorMessage(approve.error) : null}
          onConfirm={() => approve.mutate()}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "reject" && (
        <RejectModal
          application={application}
          busy={reject.isPending}
          error={reject.isError ? errorMessage(reject.error) : null}
          onSubmit={(reason, documents) => reject.mutate({ reason, documents })}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function InfoCard({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="flex flex-col rounded-[20px] bg-white px-5 pt-[18px] pb-2">
      <span className="pb-2 text-[13px] font-extrabold text-muted">
        {title}
      </span>
      {rows.map(([key, value]) => (
        <div
          key={key}
          className="flex justify-between gap-4 border-t border-hair py-3 text-[14px]"
        >
          <span className="flex-none font-semibold text-muted">{key}</span>
          <span className="text-right font-bold break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}

function DocumentCard({
  driverId,
  document,
  onOpen,
}: {
  driverId: string;
  document: DriverDocument;
  onOpen: () => void;
}) {
  const file = useDocumentFile(driverId, document);
  const missing = document.status === "NOT_SUBMITTED";
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={missing}
      className={`flex w-full flex-col gap-3 rounded-[20px] bg-white p-2.5 text-left ${
        document.status === "REJECTED"
          ? "ring-danger-2"
          : document.resubmitted
            ? "ring-ink-2"
            : ""
      }`}
    >
      <div className="stripes relative flex h-[172px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[14px] text-[#8A8A84]">
        {file.isImage && file.url ? (
          <img
            src={file.url}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <>
            {file.isImage ? <ImageIcon /> : <PdfIcon />}
            <span className="font-mono text-[11px] font-semibold text-muted">
              {missing ? "파일 없음" : fileKind(document.contentType)}
            </span>
          </>
        )}
        <div className="absolute top-2.5 left-2.5">
          <Chip kind={documentChip(document)} />
        </div>
        {!missing && (
          <span className="absolute top-2.5 right-2.5 flex size-[30px] items-center justify-center rounded-[10px] bg-white text-ink">
            <ExpandIcon />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-[3px] px-1.5 pb-1.5">
        <span className="text-[15px] font-extrabold">
          {documentLabel(document.type)}
        </span>
        <span className="text-[12px] font-semibold text-muted">
          {documentMeta(document)}
        </span>
      </div>
    </button>
  );
}
