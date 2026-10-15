import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";
import { reviewApi } from "../api/admin";
import { useMe, useSession } from "../auth/session";
import { LogoutIcon } from "../ui/icons";
import { Logo } from "../ui/kit";
import { MENU, ROLES } from "./menu";

/** 로그인한 뒤의 틀 — 왼쪽 메뉴와 오른쪽 화면. */
export function Shell() {
  const me = useMe();
  const { logout } = useSession();
  const canReview = me.areas.includes("REVIEW");
  // 메뉴 옆에 심사를 기다리는 신청 수를 보여 준다.
  const pending = useQuery({
    queryKey: ["review", "pending-count"],
    queryFn: () => reviewApi.list("PENDING", "", 1),
    enabled: canReview,
    refetchInterval: 60_000,
    select: (page) => page.counts.PENDING,
  });
  const sections = MENU.map((section) => ({
    ...section,
    items: section.items.filter((item) => me.areas.includes(item.area)),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="flex min-h-screen items-stretch">
      <aside className="sticky top-0 flex h-screen w-[236px] flex-none flex-col gap-7 overflow-y-auto bg-ink px-3.5 pt-6 pb-3.5 text-white">
        <div className="px-2.5">
          <Logo size={24} />
        </div>
        <nav className="flex flex-1 flex-col gap-[22px]" aria-label="메뉴">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-0.5">
              <span className="px-3 pb-2 text-[11px] font-extrabold tracking-[.06em] text-nav-icon">
                {section.title}
              </span>
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `group flex h-[42px] items-center gap-[11px] rounded-xl pr-2.5 pl-3 text-[14px] font-bold ${
                      isActive ? "bg-night text-white" : "text-nav"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={isActive ? "text-lime" : "text-nav-icon"}
                      >
                        <item.icon />
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {item.area === "REVIEW" && !!pending.data && (
                        <span
                          className="flex h-[22px] min-w-[22px] items-center justify-center rounded-[11px] bg-lime px-[7px] text-[12px] font-extrabold text-ink"
                          aria-label={`심사 대기 ${pending.data}건`}
                        >
                          {pending.data}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 border-t border-night pt-3.5 pr-1.5 pl-2.5">
          <span className="flex size-9 flex-none items-center justify-center rounded-full bg-lime text-[12px] font-extrabold text-ink">
            {me.name.slice(-2)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[14px] font-extrabold">
              {me.name}
            </span>
            <span className="text-[12px] font-semibold text-nav-icon">
              {ROLES[me.role].label}
            </span>
          </div>
          <button
            type="button"
            onClick={logout}
            title="로그아웃"
            aria-label="로그아웃"
            className="flex size-9 items-center justify-center rounded-[10px] text-nav hover:bg-night hover:text-white"
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-10 pt-8 pb-[72px]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-[22px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
