import { useState } from "react";
import type { AdminOrderDetail } from "../../api/types";
import { won } from "../../ui/format";
import { ActionButton, FormError, Modal, ModalHeader } from "../../ui/kit";

const QUICK_REASONS = ["배송 지연", "물품 파손", "기사 미도착", "중복 결제"];

/** 환불 처리. 전액 또는 일부를 사유와 함께 돌려준다. 결제한 카드로 환불되고 고객에게 알림이 간다. */
export function RefundModal({
  order,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  order: AdminOrderDetail;
  busy: boolean;
  error: string | null;
  onSubmit: (amount: number, reason: string) => void;
  onClose: () => void;
}) {
  const payment = order.payment;
  const left = payment.refundableAmount;
  const [mode, setMode] = useState<"full" | "part">("full");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const amount = mode === "full" ? left : Number(amountText || "0");
  const card = payment.card
    ? `${payment.card.brand} ••${payment.card.last4}`
    : "";

  const submit = () => {
    if (!amount || amount > left) {
      setProblem(`환불 금액은 1원부터 ${won(left)}까지 넣을 수 있어요`);
      return;
    }
    if (reason.trim().length < 2) {
      setProblem("환불 사유를 적어 주세요");
      return;
    }
    setProblem(null);
    onSubmit(amount, reason.trim());
  };

  return (
    <Modal label="환불 처리" width={500} gap={18} onClose={onClose}>
      <ModalHeader
        title="환불 처리"
        sub={[order.code, order.customer.name, card]
          .filter(Boolean)
          .join(" · ")}
        onClose={onClose}
      />
      <div className="flex flex-col rounded-[16px] bg-well px-4 text-[14px]">
        {(
          [
            ["결제 금액", won(payment.paidAmount)],
            ["이미 환불", won(payment.refundedAmount)],
            ["환불할 수 있는 금액", won(left)],
          ] as const
        ).map(([label, value], index) => (
          <div
            key={label}
            className={`flex justify-between py-3 ${
              index < 2 ? "border-b border-line" : ""
            }`}
          >
            <span className="font-semibold text-sub">{label}</span>
            <span
              className={`tnum ${index === 2 ? "font-extrabold" : "font-bold"}`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      <div
        role="radiogroup"
        aria-label="환불 방식"
        className="flex gap-1 rounded-[14px] bg-well p-1"
      >
        {(
          [
            ["full", "전액 환불"],
            ["part", "부분 환불"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={mode === key}
            onClick={() => setMode(key)}
            className={`h-10 flex-1 rounded-[11px] text-[14px] font-extrabold ${
              mode === key
                ? "bg-white text-ink shadow-[0_1px_2px_rgba(18,18,18,.08)]"
                : "text-sub"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "part" && (
        <label className="field gap-1 rounded-[14px] px-3.5 py-2.5">
          <span className="text-[12px] font-bold text-muted">환불 금액</span>
          <span className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={amountText}
              placeholder="0"
              onChange={(event) =>
                setAmountText(event.target.value.replace(/\D/g, ""))
              }
              className="tnum w-full bg-transparent text-[18px] font-bold outline-none"
            />
            <span className="text-[15px] font-bold">원</span>
          </span>
        </label>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-[14px] font-extrabold">환불 사유</span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setReason(quick)}
              className="h-8 rounded-[10px] bg-well px-3 text-[13px] font-bold"
            >
              {quick}
            </button>
          ))}
        </div>
        <textarea
          aria-label="환불 사유"
          value={reason}
          maxLength={200}
          placeholder="고객 알림에 함께 보여요"
          onChange={(event) => setReason(event.target.value)}
          className="field min-h-[90px] rounded-[14px] px-3.5 py-3 text-[14px] font-semibold outline-none"
        />
      </div>
      <span className="text-[12px] leading-[1.6] font-semibold text-muted">
        결제한 카드로 환불돼요. 카드사에 따라 3~7영업일 걸리고, 고객 앱 알림함에
        환불 알림이 가요.
      </span>
      <FormError message={problem ?? error} />
      <div className="flex justify-end gap-2">
        <ActionButton tone="soft" onClick={onClose}>
          취소
        </ActionButton>
        <ActionButton tone="primary" disabled={busy} onClick={submit}>
          {amount > 0 ? `${won(amount)} 환불하기` : "환불하기"}
        </ActionButton>
      </div>
    </Modal>
  );
}
