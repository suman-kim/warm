import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ApiError,
  currentRefreshToken,
  hasTokens,
  setSessionExpiredHandler,
  setTokens,
} from "../api/client";
import { authApi, storeApi } from "../api/store";
import type { Store, User } from "../api/types";

interface SessionValue {
  /** 로그인한 사장님. 로그인하지 않았으면 null, 아직 확인 중이면 undefined. */
  user: User | null | undefined;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider 안에서만 쓸 수 있어요.");
  return value;
}

/** 내 가게 (충전금이 바뀌면 다시 받는다). 로그인한 화면에서만 쓴다. */
export function useStore() {
  return useQuery({
    queryKey: ["store"],
    queryFn: storeApi.mine,
    refetchInterval: 30_000,
  });
}

/** 가게가 승인되지 않았으면 PC에서는 쓸 수 없다 — 등록과 심사는 가게 앱에서 한다. */
export function storeBlockReason(store: Store): string | null {
  switch (store.status) {
    case "PENDING":
      return "가게 심사가 끝나면 PC에서 배달을 요청할 수 있어요.";
    case "REJECTED":
      return "가게 등록이 반려됐어요. 가게 앱에서 정보를 고쳐 다시 신청해 주세요.";
    default:
      return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null | undefined>(
    hasTokens() ? undefined : null,
  );

  const signOut = useCallback(() => {
    setTokens(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setSessionExpiredHandler(signOut);
    if (!hasTokens()) return;
    let cancelled = false;
    authApi
      .me()
      .then((me) => !cancelled && setUser(me))
      .catch(() => !cancelled && signOut());
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      login: async (email, password) => {
        const session = await authApi.login(email.trim(), password);
        if (session.user.role !== "CUSTOMER") {
          throw new ApiError(
            403,
            "NOT_STORE",
            "가게 계정이 아니에요. 라이더는 라이더 앱에서 로그인해 주세요.",
          );
        }
        setTokens(session);
        try {
          // 가게를 등록하지 않았으면 들여보내지 않는다.
          await storeApi.mine();
        } catch (error) {
          setTokens(null);
          if (
            error instanceof ApiError &&
            error.code === "STORE_NOT_REGISTERED"
          ) {
            throw new ApiError(
              404,
              error.code,
              "등록한 가게가 없어요. 가게 등록과 심사는 가게 앱에서 해요.",
            );
          }
          throw error;
        }
        setUser(session.user);
      },
      logout: () => {
        const refreshToken = currentRefreshToken();
        if (refreshToken) authApi.logout(refreshToken).catch(() => {});
        signOut();
      },
    }),
    [user, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
