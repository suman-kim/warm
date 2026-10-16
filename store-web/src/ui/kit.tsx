import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import type { OrderStatus } from "../api/types";
import { statusChip } from "./format";
import { CloseIcon } from "./icons";

/** 상태 꼬리표 */
export function StatusChip({ status }: { status: OrderStatus }) {
  const chip = statusChip(status);
  return (
    <span
      className={`inline-flex h-6 items-center rounded-lg px-2 text-[12px] font-extrabold whitespace-nowrap ${chip.className}`}
    >
      {chip.label}
    </span>
  );
}

/** 회색 바탕 위에서 하나를 고르는 탭 */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 rounded-[14px] bg-well p-1"
    >
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.key)}
            className={`h-9 rounded-[11px] px-3.5 text-[14px] font-extrabold ${
              selected ? "bg-white text-ink shadow-sm" : "text-tab"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** 켜고 끄는 스위치 */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 flex-none rounded-full ${checked ? "bg-ink" : "bg-box"}`}
    >
      <span
        className={`absolute top-[3px] size-[22px] rounded-full transition-all ${
          checked ? "left-[23px] bg-white" : "left-[3px] bg-white"
        }`}
      />
    </button>
  );
}

/** 대화상자. 바깥을 누르거나 Esc를 누르면 닫힌다. */
export function Modal({
  label,
  width,
  onClose,
  children,
}: {
  label: string;
  width: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useDialogFocus(panel, onClose);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,18,18,.48)] p-6"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100vh-48px)] w-full flex-col gap-5 overflow-y-auto rounded-[26px] bg-white p-[26px] shadow-[0_30px_80px_-30px_rgba(0,0,0,.5)] outline-none"
        style={{ maxWidth: width }}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  title,
  sub,
  onClose,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[21px] font-extrabold tracking-[-0.02em]">
          {title}
        </span>
        {sub && (
          <span className="text-[14px] font-semibold text-muted">{sub}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="flex size-9 flex-none items-center justify-center rounded-xl bg-hair"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function useDialogFocus(
  panel: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [panel]);
}

/** 이름·값 한 줄 */
export function KeyValue({
  label,
  value,
  strong,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-rule py-2.5 last:border-b-0">
      <span className="flex-none text-[13px] font-semibold text-muted">
        {label}
      </span>
      <span
        className={`tnum text-right text-[13px] ${strong ? "font-extrabold" : "font-bold"}`}
      >
        {value}
      </span>
    </div>
  );
}

/** 작은 키보드 글쇠 표시 */
export function Key({
  children,
  dark,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <kbd
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 font-sans text-[11px] font-extrabold ${
        dark ? "bg-lime text-ink" : "bg-well text-sub"
      }`}
    >
      {children}
    </kbd>
  );
}

/** MOVO 로고와 꼬리표 (사장님 / 사장님 · PC) */
export function Logo({ badge, dark }: { badge: string; dark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-baseline text-[22px] leading-none font-black tracking-[-0.05em]"
        aria-label="MOVO"
      >
        mov
        <span
          className={`ml-[.04em] size-[.56em] rounded-full bg-lime ${
            dark ? "" : "shadow-[inset_0_0_0_.11em_#121212]"
          }`}
        />
      </div>
      <span className="rounded-[7px] bg-lime px-[7px] py-1 text-[11px] font-extrabold text-ink">
        {badge}
      </span>
    </div>
  );
}
