import { type ReactNode, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { storeBlockReason, useSession, useStore } from "../auth/session";
import { ampm, won } from "../ui/format";
import {
  BoardIcon,
  ListIcon,
  RefreshIcon,
  StoreIcon,
  WalletIcon,
} from "../ui/icons";
import { Logo } from "../ui/kit";

const MENU = [
  { path: "/board", label: "배달 보드", icon: BoardIcon },
  { path: "/history", label: "내역", icon: ListIcon },
  { path: "/wallet", label: "충전금", icon: WalletIcon },
  { path: "/store", label: "가게 정보", icon: StoreIcon },
];

/** 로그인한 뒤의 틀 — 왼쪽 메뉴(아래에 충전금), 오른쪽 화면. */
export function Shell() {
  const { logout } = useSession();
  const navigate = useNavigate();
  const store = useStore();
  const blocked = store.data ? storeBlockReason(store.data) : null;

  return (
    <div className="flex h-screen items-stretch overflow-hidden">
      <aside className="flex w-[236px] flex-none flex-col gap-6 border-r border-line bg-white px-3.5 pt-6 pb-3.5">
        <div className="px-2.5">
          <Logo badge="사장님" />
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="메뉴">
          {MENU.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex h-[42px] items-center gap-[11px] rounded-xl px-3 text-[14px] font-bold ${
                  isActive ? "bg-hair text-ink" : "text-tab"
                }`
              }
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-3 rounded-[20px] bg-ink p-4 text-white">
          <span className="text-[12px] font-bold text-nav">충전금</span>
          <span className="tnum text-[24px] font-extrabold tracking-[-0.03em]">
            {won(store.data?.walletBalance ?? 0)}
          </span>
          <button
            type="button"
            onClick={() => navigate("/wallet")}
            className="h-10 rounded-xl bg-lime text-[14px] font-extrabold text-ink"
          >
            충전하기
          </button>
        </div>
        <div className="flex items-center gap-2 px-1">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[14px] font-extrabold">
              {store.data?.name ?? ""}
            </span>
            <span className="text-[12px] font-semibold text-muted">
              카운터 PC
            </span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg px-2 py-1 text-[12px] font-bold text-muted"
          >
            로그아웃
          </button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        {blocked ? (
          <div className="flex flex-1 items-center justify-center p-10">
            <div className="flex max-w-[420px] flex-col gap-3 rounded-[24px] bg-white p-8 text-center">
              <span className="text-[20px] font-extrabold">
                아직 배달을 요청할 수 없어요
              </span>
              <span className="text-[14px] font-semibold text-muted">
                {blocked}
              </span>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}

/** 화면 위쪽 막대: 제목, 자동 새로고침 시각, 지금 시각. */
export function TopBar({
  title,
  updatedAt,
  onRefresh,
  children,
}: {
  title: string;
  /** 마지막으로 받은 시각 (ms). 0이면 아직 없다. */
  updatedAt: number;
  onRefresh: () => void;
  children?: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = updatedAt
    ? Math.max(0, Math.round((now - updatedAt) / 1000))
    : 0;
  return (
    <header className="flex h-[68px] flex-none items-center gap-3 border-b border-line bg-paper px-6">
      <h1 className="m-0 flex-1 text-[22px] font-extrabold tracking-[-0.03em]">
        {title}
      </h1>
      {children}
      <button
        type="button"
        onClick={onRefresh}
        className="flex h-8 items-center gap-2 rounded-[10px] bg-white px-3 text-[12px] font-bold text-sub shadow-[inset_0_0_0_1px_#E6E4DE]"
      >
        <span className="size-1.5 rounded-full bg-ok-dot" />
        자동 새로고침 ·{" "}
        {seconds < 60 ? `${seconds}초 전` : `${Math.round(seconds / 60)}분 전`}
        <RefreshIcon />
      </button>
      <span className="tnum min-w-[80px] text-right text-[15px] font-extrabold">
        {ampm(new Date(now))}
      </span>
    </header>
  );
}
