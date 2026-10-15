// 여러 화면이 함께 쓰는 조각들. 크기와 색은 디자인(design/MOVO Admin.dc.html)의 값이다.

import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { CheckIcon, CloseIcon, SearchIcon } from "./icons";

/** 화면 제목과 한 줄 설명. */
export function PageTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.03em]">
        {title}
      </h1>
      <span className="text-[14px] font-semibold text-muted">{sub}</span>
    </div>
  );
}

export interface TabItem<K extends string> {
  key: K;
  label: string;
  /** 탭 옆에 보일 건수 */
  count?: number;
}

/** 회색 바탕 위에서 하나를 고르는 탭. */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label,
  className = "",
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** 화면 낭독기에 읽어 줄 이름 */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex gap-1 rounded-[14px] bg-well p-1 ${className}`}
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
            className={`flex h-9 items-center justify-center gap-[7px] rounded-[11px] text-[14px] font-extrabold ${
              item.count === undefined ? "px-3.5" : "pr-3 pl-3.5"
            } ${
              selected
                ? "bg-white text-ink shadow-[0_1px_2px_rgba(18,18,18,.08)]"
                : "text-tab"
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded-[10px] px-1.5 text-[11px] font-extrabold ${
                  selected ? "bg-ink text-white" : "bg-[#DAD8D1] text-sub"
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 테두리만 있는 작은 탭 (회원 상태 고르기). */
export function OutlineTabs<K extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1">
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.key)}
            className={`h-9 rounded-[11px] px-[13px] text-[13px] font-extrabold ${
              selected ? "ring-ink bg-white text-ink" : "ring-line text-tab"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** 돋보기가 붙은 검색란. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label
      className={`field h-11 flex-row items-center gap-2.5 rounded-[14px] px-3.5 text-muted ${className}`}
    >
      <SearchIcon />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="text-[14px] font-semibold text-ink"
      />
    </label>
  );
}

/** 표를 담는 흰 상자. 좁은 화면에서는 가로로 밀어 본다. */
export function TableCard({
  minWidth,
  children,
}: {
  minWidth: number;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-[20px] bg-white">
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

/** 표의 머리 줄. [columns]는 줄들과 같은 grid-template-columns 값이다. */
export function TableHead({
  columns,
  height = 46,
  children,
}: {
  columns: string;
  height?: number;
  children: ReactNode;
}) {
  return (
    <div
      role="row"
      className="grid items-center gap-4 px-[22px] text-[12px] font-bold text-muted"
      style={{ gridTemplateColumns: columns, height }}
    >
      {children}
    </div>
  );
}

/** 표의 한 줄. [onClick]을 주면 눌러서 여는 줄이 된다. */
export function TableRow({
  columns,
  onClick,
  className = "",
  style,
  children,
}: {
  columns: string;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const interactive = onClick
    ? {
        onClick,
        tabIndex: 0,
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === "Enter" && event.target === event.currentTarget) {
            onClick();
          }
        },
      }
    : {};
  return (
    <div
      role="row"
      {...interactive}
      className={`grid items-center gap-4 border-t border-rule px-[22px] text-[14px] font-semibold ${
        onClick ? "cursor-pointer hover:bg-hover" : ""
      } ${className}`}
      style={{ gridTemplateColumns: columns, ...style }}
    >
      {children}
    </div>
  );
}

/** 표에 보여 줄 줄이 없을 때, 불러오는 중일 때, 불러오지 못했을 때의 자리. */
export function TableNote({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 border-t border-rule py-14 text-center text-[14px] font-semibold text-muted">
      {children}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ring-line h-8 rounded-[10px] bg-white px-3 text-[13px] font-bold text-ink"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

/**
 * 목록의 상태에 맞는 자리 — 불러오는 중, 실패, 비어 있음. 보여 줄 줄이 있으면 아무것도 그리지 않는다.
 */
export function ListState({
  loading,
  error,
  empty,
  emptyText,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  emptyText: string;
  onRetry: () => void;
}) {
  if (loading) {
    return <TableNote>불러오는 중이에요</TableNote>;
  }
  if (error) {
    return <TableNote onRetry={onRetry}>불러오지 못했어요</TableNote>;
  }
  return empty ? <TableNote>{emptyText}</TableNote> : null;
}

/** 목록이 더 있을 때 이어 받는 단추. */
export function LoadMore({
  shown,
  total,
  loading,
  onMore,
}: {
  shown: number;
  total: number;
  loading: boolean;
  onMore: () => void;
}) {
  if (shown >= total) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={onMore}
      disabled={loading}
      className="ring-line h-11 self-center rounded-[14px] bg-white px-5 text-[14px] font-bold disabled:opacity-50"
    >
      {loading ? "불러오는 중이에요" : `더 보기 (${shown} / ${total})`}
    </button>
  );
}

/** 네모난 체크 상자 모양의 단추. */
export function CheckBox({
  checked,
  disabled,
  dim,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  /** 고를 수 없지만 눌렀을 때 이유를 알려 주는 상자 — 흐리게만 보인다. */
  dim?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`flex size-[22px] flex-none items-center justify-center rounded-[7px] disabled:opacity-30 ${
        dim ? "opacity-30" : ""
      } ${checked ? "bg-ink text-white" : "ring-box bg-white text-transparent"}`}
    >
      <CheckIcon />
    </button>
  );
}

type ButtonTone = "primary" | "danger" | "soft" | "outline" | "dangerOutline";

const BUTTON_TONES: Record<ButtonTone, string> = {
  primary: "bg-ink text-white",
  danger: "bg-danger text-white",
  soft: "bg-hair",
  outline: "ring-line bg-white",
  dangerOutline: "ring-danger bg-white text-danger",
};

/** 대화상자 아래의 큰 단추 (높이 48). */
export function ActionButton({
  tone = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return (
    <button
      type="button"
      {...props}
      className={`h-12 rounded-[14px] text-[15px] font-extrabold disabled:opacity-40 ${
        tone === "soft" || tone === "outline" ? "px-5" : "px-[22px]"
      } ${BUTTON_TONES[tone]} ${className}`}
    />
  );
}

/** 화면 오른쪽 위의 '올리기' 단추 (높이 46, 앞에 아이콘). */
export function HeaderButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-[46px] items-center gap-2 rounded-[14px] bg-ink pr-5 pl-4 text-[15px] font-extrabold text-white"
    >
      {children}
    </button>
  );
}

/** 닫기(×) 단추. */
export function CloseButton({
  onClick,
  dark,
  large,
}: {
  onClick: () => void;
  dark?: boolean;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="닫기"
      className={`flex flex-none items-center justify-center rounded-xl ${
        large ? "size-10" : "size-9"
      } ${dark ? "bg-night" : "bg-hair"}`}
    >
      <CloseIcon />
    </button>
  );
}

/** 대화상자 안의 오류 문구. */
export function FormError({ message }: { message: string | null }) {
  return message ? (
    <span role="alert" className="-mt-2 text-[13px] font-bold text-danger">
      {message}
    </span>
  ) : null;
}

/**
 * 대화상자. 바깥을 누르거나 Esc를 누르면 닫힌다.
 * 열리면 안으로 초점을 옮기고, 닫히면 열기 전에 있던 곳으로 돌려준다.
 */
export function Modal({
  label,
  width,
  gap = 20,
  onClose,
  children,
}: {
  /** 화면 낭독기에 읽어 줄 이름 */
  label: string;
  /** 가장 넓을 때의 폭(px) */
  width: number;
  /** 안의 묶음 사이 간격(px) */
  gap?: number;
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
        className="flex max-h-[calc(100vh-48px)] w-full flex-col overflow-y-auto rounded-[26px] bg-white p-[26px] shadow-[0_30px_80px_-30px_rgba(0,0,0,.5)] outline-none"
        style={{ maxWidth: width, gap }}
      >
        {children}
      </div>
    </div>
  );
}

/** 대화상자·서랍이 열려 있는 동안의 초점과 Esc 처리. */
export function useDialogFocus(
  panel: React.RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // 위에 다른 대화상자가 떠 있으면 맨 위의 것만 닫는다.
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (
        event.key === "Escape" &&
        dialogs[dialogs.length - 1] === panel.current
      ) {
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

/** 확인만 묻는 작은 대화상자 (제목, 설명, 취소·확인). */
export function ConfirmModal({
  title,
  body,
  confirm,
  tone = "primary",
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirm: string;
  tone?: "primary" | "danger";
  busy: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal label={title} width={440} gap={22} onClose={onClose}>
      <div className="flex flex-col gap-2.5">
        <span className="text-[21px] font-extrabold tracking-[-0.02em]">
          {title}
        </span>
        <span className="text-[15px] leading-[1.6] font-semibold text-sub">
          {body}
        </span>
      </div>
      <FormError message={error ?? null} />
      <div className="flex justify-end gap-2">
        <ActionButton tone="soft" onClick={onClose}>
          취소
        </ActionButton>
        <ActionButton tone={tone} disabled={busy} onClick={onConfirm}>
          {confirm}
        </ActionButton>
      </div>
    </Modal>
  );
}

/** 대화상자의 제목 줄 (제목과 닫기 단추). */
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
      <CloseButton onClick={onClose} />
    </div>
  );
}

/** 'MOVO' 글자 로고와 '관리자' 표. */
export function Logo({ size }: { size: 24 | 28 }) {
  return (
    <div className={`flex items-center ${size === 28 ? "gap-2.5" : "gap-2"}`}>
      <div
        className="flex items-baseline leading-none font-black tracking-[-0.05em]"
        style={{ fontSize: size }}
        aria-label="MOVO"
      >
        mov
        <span className="ml-[.04em] size-[.56em] rounded-full bg-lime shadow-[inset_0_0_0_.11em_#121212]" />
      </div>
      <span
        className={`bg-lime font-extrabold text-ink ${
          size === 28
            ? "rounded-[9px] px-[9px] py-[5px] text-[12px]"
            : "rounded-[7px] px-[7px] py-1 text-[11px]"
        }`}
      >
        관리자
      </span>
    </div>
  );
}
