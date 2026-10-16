import type { ReactNode } from "react";
import { Logo } from "../ui/kit";

/** 로그인과 초대 수락 화면의 틀 — 왼쪽에 소개, 오른쪽에 입력란. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[repeat(auto-fit,minmax(360px,1fr))]">
      <div className="flex flex-col justify-between gap-12 bg-ink px-12 py-11 text-white">
        <Logo size={28} />
        <div className="flex max-w-[440px] flex-col gap-3.5">
          <span className="text-[40px] leading-[1.22] font-extrabold tracking-[-0.04em]">
            가게·라이더 심사부터 정산까지
            <br />
            한곳에서 관리해요
          </span>
          <span className="text-[15px] leading-[1.6] font-semibold text-nav">
            가게 앱과 라이더 앱 운영에 필요한 화면을 모았어요.
          </span>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[380px] flex-col gap-7">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.035em]">
        {title}
      </h1>
      <span className="text-[14px] leading-[1.5] font-semibold text-muted">
        {sub}
      </span>
    </div>
  );
}

/** 이름표가 안에 든 큰 입력란. */
export function AuthField({
  label,
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field gap-[3px] rounded-2xl px-4 py-2.5">
      <span className="text-[12px] font-bold text-muted">{label}</span>
      <input {...input} className="text-[16px] font-semibold" />
    </label>
  );
}

export function AuthSubmit({
  children,
  busy,
}: {
  children: ReactNode;
  busy: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="flex h-14 items-center justify-center rounded-[18px] bg-ink text-[17px] font-extrabold text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function AuthError({ message }: { message: string | null }) {
  return message ? (
    <span role="alert" className="px-1 text-[13px] font-bold text-danger">
      {message}
    </span>
  ) : null;
}
