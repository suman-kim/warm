import { type FormEvent, useState } from "react";
import { ApiError, errorMessage } from "../api/client";
import {
  AuthError,
  AuthField,
  AuthLayout,
  AuthSubmit,
  AuthTitle,
} from "./AuthLayout";
import { useSession } from "./session";

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
    <AuthLayout>
      <AuthTitle
        title="관리자 로그인"
        sub="관리자 계정은 최고 관리자가 초대해요"
      />
      <form onSubmit={submit} noValidate className="flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <AuthField
            label="이메일"
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
          />
          <AuthField
            label="비밀번호"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
          />
          <AuthError message={error} />
        </div>
        <AuthSubmit busy={busy}>로그인</AuthSubmit>
      </form>
    </AuthLayout>
  );
}
