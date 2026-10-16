// 서버 API를 부르는 곳은 여기 하나다. 토큰을 붙이고, 만료되면 한 번 갱신해 다시 부른다.

const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api"
).replace(/\/+$/, "");
const STORAGE_KEY = "movo-store-tokens";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** 서버가 돌려준 오류. [code]로 갈라 처리하고, [message]는 화면에 그대로 보여 줄 수 있다. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 화면에 보여 줄 오류 문구. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.";
}

type Query = Record<string, string | number | undefined>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** false면 토큰을 붙이지 않는다 (로그인, 초대 수락). */
  auth?: boolean;
}

let tokens: Tokens | null = readStoredTokens();
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: () => void = () => {};

function readStoredTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function hasTokens(): boolean {
  return tokens !== null;
}

export function setTokens(next: Tokens | null): void {
  tokens = next;
  if (next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function currentRefreshToken(): string | null {
  return tokens?.refreshToken ?? null;
}

/** 토큰을 갱신하지 못해 로그인이 풀렸을 때 부를 함수를 정한다. */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

function url(path: string, query?: Query): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const suffix = search.size > 0 ? `?${search}` : "";
  return `${BASE_URL}${path}${suffix}`;
}

async function send(
  method: string,
  path: string,
  options: RequestOptions,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.auth !== false && tokens) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  try {
    return await fetch(url(path, options.query), {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK",
      "서버에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.",
    );
  }
}

/** 여러 요청이 한꺼번에 만료돼도 갱신은 한 번만 한다. */
function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = tokens?.refreshToken;
    if (!refreshToken) {
      return false;
    }
    try {
      const response = await send("POST", "/auth/refresh", {
        body: { refreshToken },
        auth: false,
      });
      if (!response.ok) {
        return false;
      }
      setTokens((await response.json()) as Tokens);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function toError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    code?: string;
    message?: string | string[];
  } | null;
  const message = Array.isArray(body?.message)
    ? body.message.join("\n")
    : body?.message;
  return new ApiError(
    response.status,
    body?.code ?? "UNKNOWN",
    message ?? "문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.",
  );
}

async function authorized(
  method: string,
  path: string,
  options: RequestOptions,
): Promise<Response> {
  let response = await send(method, path, options);
  // 액세스 토큰이 만료됐으면 갱신하고 한 번만 다시 부른다.
  if (response.status === 401 && options.auth !== false && tokens) {
    if (await refresh()) {
      response = await send(method, path, options);
    } else {
      setTokens(null);
      onSessionExpired();
    }
  }
  if (!response.ok) {
    throw await toError(response);
  }
  return response;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await authorized(method, path, options);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>("PATCH", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  delete: <T>(path: string) => request<T>("DELETE", path),
  /** 파일을 받는다. */
  blob: async (path: string): Promise<Blob> =>
    (await authorized("GET", path, {})).blob(),
};
