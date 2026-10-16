import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authApi } from "../api/admin";
import {
  ApiError,
  currentRefreshToken,
  hasTokens,
  setSessionExpiredHandler,
  setTokens,
} from "../api/client";
import type { AdminMe, Session as Tokens } from "../api/types";

interface SessionValue {
  /** 로그인한 운영자. 로그인하지 않았으면 null, 아직 확인 중이면 undefined. */
  me: AdminMe | null | undefined;
  login: (email: string, password: string) => Promise<void>;
  /** 초대를 수락해(비밀번호를 정해) 로그인한다. */
  acceptInvitation: (token: string, password: string) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("SessionProvider 안에서만 쓸 수 있어요.");
  }
  return value;
}

/** 로그인한 운영자. 로그인한 화면(Shell 안)에서만 쓴다. */
export function useMe(): AdminMe {
  const { me } = useSession();
  if (!me) {
    throw new Error("로그인한 화면에서만 쓸 수 있어요.");
  }
  return me;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AdminMe | null | undefined>(
    hasTokens() ? undefined : null,
  );

  const signOut = useCallback(() => {
    setTokens(null);
    setMe(null);
  }, []);

  // 저장해 둔 토큰이 있으면 누구인지 다시 확인한다.
  useEffect(() => {
    setSessionExpiredHandler(signOut);
    if (!hasTokens()) {
      return;
    }
    let cancelled = false;
    authApi
      .me()
      .then((account) => !cancelled && setMe(account))
      .catch(() => !cancelled && signOut());
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  const enter = useCallback(
    async (tokens: Tokens) => {
      if (tokens.user.role !== "ADMIN") {
        throw new ApiError(
          403,
          "NOT_ADMIN",
          "관리자 계정이 아니에요. 가게·라이더 계정은 앱에서 로그인해 주세요.",
        );
      }
      setTokens(tokens);
      try {
        setMe(await authApi.me());
      } catch (error) {
        signOut();
        throw error;
      }
    },
    [signOut],
  );

  const value = useMemo<SessionValue>(
    () => ({
      me,
      login: async (email, password) =>
        enter(await authApi.login(email.trim(), password)),
      acceptInvitation: async (token, password) =>
        enter(await authApi.acceptInvitation(token, password)),
      logout: () => {
        const refreshToken = currentRefreshToken();
        if (refreshToken) {
          // 서버의 토큰을 못 지워도 이 브라우저에서는 로그아웃한다.
          authApi.logout(refreshToken).catch(() => {});
        }
        signOut();
      },
    }),
    [me, enter, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
