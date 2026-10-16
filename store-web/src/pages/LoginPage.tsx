import { type FormEvent, useState } from "react";
import { ApiError, errorMessage } from "../api/client";
import { useSession } from "../auth/session";
import { Logo } from "../ui/kit";

/** 가게 계정으로 로그인 (카운터 PC). 가게 등록과 심사는 가게 앱에서 한다. */
export function LoginPage() {
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해 주세요");
      return;
    }
    setBusy(true);
    try {
      await login(email, password);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "INVALID_CREDENTIALS"
          ? "이메일 또는 비밀번호가 맞지 않아요"
          : errorMessage(cause),
      );
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-[repeat(auto-fit,minmax(360px,1fr))]">
      <div className="flex flex-col justify-between gap-12 bg-ink px-12 py-11 text-white">
        <Logo badge="사장님 · PC" dark />
        <div className="flex max-w-[440px] flex-col gap-3.5">
          <span className="text-[40px] leading-[1.22] font-extrabold tracking-[-0.04em]">
            카운터에서
            <br />
            배달을 바로 요청해요
          </span>
          <span className="text-[15px] leading-[1.6] font-semibold text-nav">
            키보드만으로 주소부터 조리 시간까지 넣고 Enter로 요청해요.
            <br />
            진행 중인 배달은 보드에서 한눈에 봐요.
          </span>
        </div>
        <span className="text-[13px] font-semibold text-nav-icon">
          고객센터 1600-0000
        </span>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <form
          onSubmit={submit}
          noValidate
          className="flex w-full max-w-[380px] flex-col gap-3"
        >
          <h1 className="m-0 mb-4 text-[24px] font-extrabold tracking-[-0.03em]">
            가게 계정으로 로그인
          </h1>
          <Field
            label="이메일"
            type="email"
            value={email}
            autoComplete="username"
            onChange={(value) => {
              setEmail(value);
              setError(null);
            }}
          />
          <Field
            label="비밀번호"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(value) => {
              setPassword(value);
              setError(null);
            }}
          />
          {error && (
            <span role="alert" className="text-[13px] font-bold text-danger">
              {error}
            </span>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 h-[54px] rounded-2xl bg-ink text-[16px] font-extrabold text-white disabled:opacity-50"
          >
            로그인
          </button>
          <span className="text-center text-[13px] font-semibold text-muted">
            가게 등록과 심사는 가게 앱에서 해요
          </span>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  autoComplete,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 rounded-2xl bg-white px-4 py-3 shadow-[inset_0_0_0_1.5px_#E6E4DE] focus-within:shadow-[inset_0_0_0_2px_#121212]">
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-[16px] font-bold outline-none"
      />
    </label>
  );
}
