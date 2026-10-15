import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { authApi } from "../api/admin";
import { errorMessage } from "../api/client";
import {
  AuthError,
  AuthField,
  AuthLayout,
  AuthSubmit,
  AuthTitle,
} from "./AuthLayout";
import { useSession } from "./session";

/**
 * 초대 메일의 링크로 들어온 화면. 비밀번호를 정하면 바로 로그인된다.
 * 디자인에는 없는 화면이라 로그인 화면의 모양을 그대로 따랐다.
 */
export function InvitePage() {
  const { token = "" } = useParams();
  const { acceptInvitation } = useSession();
  const invitation = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => authApi.invitation(token),
    retry: false,
  });
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== again) {
      setError("비밀번호가 서로 달라요");
      return;
    }
    setBusy(true);
    try {
      await acceptInvitation(token, password);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }

  if (invitation.isPending) {
    return (
      <AuthLayout>
        <AuthTitle title="초대를 확인하고 있어요" sub="잠시만 기다려 주세요" />
      </AuthLayout>
    );
  }
  if (invitation.isError) {
    return (
      <AuthLayout>
        <AuthTitle
          title="초대 링크를 쓸 수 없어요"
          sub={errorMessage(invitation.error)}
        />
        <Link to="/login" className="text-[14px] font-bold underline">
          로그인 화면으로
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthTitle
        title="비밀번호 정하기"
        sub={`${invitation.data.name} 님, 관리자로 초대됐어요. 로그인할 때 쓸 비밀번호를 정해 주세요.`}
      />
      <form onSubmit={submit} noValidate className="flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <AuthField
            label="이메일"
            type="email"
            autoComplete="username"
            readOnly
            value={invitation.data.email}
          />
          <AuthField
            label="비밀번호 (영문과 숫자를 포함해 8자 이상)"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
          />
          <AuthField
            label="비밀번호 한 번 더"
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(event) => {
              setAgain(event.target.value);
              setError(null);
            }}
          />
          <AuthError message={error} />
        </div>
        <AuthSubmit busy={busy}>시작하기</AuthSubmit>
      </form>
    </AuthLayout>
  );
}
