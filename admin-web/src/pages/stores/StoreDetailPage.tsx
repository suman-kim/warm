import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { storesApi } from "../../api/admin";
import { errorMessage } from "../../api/client";
import type { AdminStore } from "../../api/types";
import { Chip } from "../../ui/chip";
import { businessNumber, phone, shortDateTime } from "../../ui/format";
import { BackIcon } from "../../ui/icons";
import {
  ActionButton,
  ConfirmModal,
  FormError,
  Modal,
  ModalHeader,
  TableNote,
} from "../../ui/kit";
import { useToast } from "../../ui/toast";

/** 자주 쓰는 반려 사유. 누르면 사유 칸에 덧붙는다. */
const QUICK_REASONS = [
  "사업자등록증의 상호와 입력한 상호가 달라요.",
  "사업자등록번호를 확인할 수 없어요.",
  "가게 주소가 사업장 주소와 달라요.",
];

/** 가게 심사 상세. 가게 정보와 사장님, 픽업지를 보고 승인하거나 반려한다. */
export function StoreDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<"approve" | "reject" | null>(null);
  const detail = useQuery({
    queryKey: ["stores", "detail", id],
    queryFn: () => storesApi.detail(id),
  });
  const settle = (store: AdminStore, message: string) => {
    queryClient.setQueryData(["stores", "detail", id], store);
    void queryClient.invalidateQueries({ queryKey: ["stores", "list"] });
    void queryClient.invalidateQueries({
      queryKey: ["stores", "pending-count"],
    });
    setModal(null);
    toast(message);
  };
  const approve = useMutation({
    mutationFn: () => storesApi.approve(id),
    onSuccess: (store) =>
      settle(store, "승인했어요. 이제 배달을 요청할 수 있어요"),
  });
  const reject = useMutation({
    mutationFn: (reason: string) => storesApi.reject(id, reason),
    onSuccess: (store) =>
      settle(store, "반려했어요. 사장님이 정보를 고쳐 다시 신청할 수 있어요"),
  });

  const back = (
    <Link
      to="/stores"
      className="-ml-1 flex h-8 items-center gap-1 self-start text-[14px] font-bold text-sub"
    >
      <BackIcon />
      가게 심사
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

  const store = detail.data;
  const address = [store.address.address, store.address.detailAddress]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      {back}
      <div className="-mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.03em]">
              {store.name}
            </h1>
            <Chip kind={store.status} large />
          </div>
          <span className="text-[14px] font-semibold text-muted">
            {shortDateTime(store.appliedAt)} 신청 · {address}
          </span>
        </div>
        {store.status === "PENDING" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModal("reject")}
              className="h-[46px] rounded-[14px] bg-danger-soft px-[22px] text-[15px] font-extrabold text-danger"
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

      {store.status === "REJECTED" && store.rejectionReason && (
        <div className="flex flex-col gap-1.5 rounded-[18px] bg-danger-soft px-5 py-4">
          <span className="text-[12px] font-extrabold text-danger">
            반려 사유
          </span>
          <span className="text-[15px] font-bold">{store.rejectionReason}</span>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card title="가게 정보">
          <Row label="상호" value={store.name} />
          <Row
            label="사업자등록번호"
            value={businessNumber(store.businessNumber)}
          />
          <Row label="가게 전화" value={phone(store.phone)} />
          <Row label="가게 주소" value={store.address.address} />
          <Row label="상세주소" value={store.address.detailAddress || "없음"} />
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="사장님">
            <Row label="이름" value={store.ownerName ?? "탈퇴한 회원"} />
            <Row label="이메일" value={store.ownerEmail ?? "—"} />
            <Row label="신청" value={shortDateTime(store.appliedAt)} />
          </Card>
          <Card title="픽업지">
            <div className="relative h-[150px] overflow-hidden rounded-[14px] bg-[#E9E6DF] [background-image:linear-gradient(#DCD8CF_1px,transparent_1px),linear-gradient(90deg,#DCD8CF_1px,transparent_1px)] [background-size:28px_28px]">
              <span className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
                <span className="rounded-[10px] bg-ink px-2.5 py-1 text-[12px] font-extrabold whitespace-nowrap text-white">
                  {store.name}
                </span>
                <span className="h-2 w-0.5 bg-ink" />
              </span>
            </div>
            <span className="pt-3 text-[13px] font-semibold text-body">
              {address} · {store.address.dong}
            </span>
          </Card>
        </div>
      </div>

      {modal === "approve" && (
        <ConfirmModal
          title="가게를 승인할까요?"
          body={`${store.name} 사장님이 바로 배달을 요청할 수 있어요.`}
          confirm="승인"
          busy={approve.isPending}
          error={approve.isError ? errorMessage(approve.error) : null}
          onConfirm={() => approve.mutate()}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "reject" && (
        <RejectStoreModal
          store={store}
          busy={reject.isPending}
          error={reject.isError ? errorMessage(reject.error) : null}
          onSubmit={(reason) => reject.mutate(reason)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-[20px] bg-white px-5 pt-5 pb-3">
      <h2 className="m-0 pb-2 text-[16px] font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hair py-3 last:border-b-0">
      <span className="text-[14px] font-semibold text-muted">{label}</span>
      <span className="tnum text-right text-[14px] font-bold">{value}</span>
    </div>
  );
}

function RejectStoreModal({
  store,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  store: AdminStore;
  busy: boolean;
  error: string | null;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const submit = () => {
    if (reason.trim().length < 5) {
      setInvalid("반려 사유를 적어 주세요");
      return;
    }
    onSubmit(reason.trim());
  };
  return (
    <Modal label="가게 반려" width={520} gap={20} onClose={onClose}>
      <ModalHeader title="가게 반려" sub={store.name} onClose={onClose} />
      <div className="flex flex-wrap gap-2">
        {QUICK_REASONS.map((quick) => (
          <button
            key={quick}
            type="button"
            onClick={() => {
              setReason((now) => (now ? `${now} ${quick}` : quick));
              setInvalid(null);
            }}
            className="rounded-[10px] bg-well px-3 py-2 text-[13px] font-bold"
          >
            {quick}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-extrabold">반려 사유</span>
        <textarea
          value={reason}
          maxLength={300}
          rows={4}
          onChange={(event) => {
            setReason(event.target.value);
            setInvalid(null);
          }}
          placeholder="사장님이 가게 앱에서 보는 문구예요"
          className="resize-none rounded-[14px] p-3.5 text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_#DAD8D1] outline-none focus:shadow-[inset_0_0_0_2px_#121212]"
        />
      </label>
      <FormError message={invalid ?? error} />
      <div className="flex justify-end gap-2">
        <ActionButton tone="soft" onClick={onClose}>
          닫기
        </ActionButton>
        <ActionButton tone="danger" disabled={busy} onClick={submit}>
          반려
        </ActionButton>
      </div>
    </Modal>
  );
}
