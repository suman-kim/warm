import type { ComponentType } from "react";
import type { AdminArea, AdminRole } from "../api/types";
import {
  AdminsIcon,
  CashIcon,
  DeliveryIcon,
  MembersIcon,
  NoticeIcon,
  ReviewIcon,
  SettleIcon,
  StoreIcon,
  TermsIcon,
  WalletIcon,
} from "../ui/icons";

export interface MenuItem {
  area: AdminArea;
  path: string;
  label: string;
  icon: ComponentType;
}

/** 왼쪽 메뉴. 권한에 없는 메뉴는 보이지 않는다. */
export const MENU: { title: string; items: MenuItem[] }[] = [
  {
    title: "운영",
    items: [
      { area: "REVIEW", path: "/stores", label: "가게 심사", icon: StoreIcon },
      {
        area: "REVIEW",
        path: "/review",
        label: "라이더 심사",
        icon: ReviewIcon,
      },
      {
        area: "ORDERS",
        path: "/deliveries",
        label: "배달 관제",
        icon: DeliveryIcon,
      },
      {
        area: "SETTLEMENTS",
        path: "/wallets",
        label: "가게 충전금",
        icon: WalletIcon,
      },
      {
        area: "SETTLEMENTS",
        path: "/rider-cash",
        label: "라이더 현금 수금",
        icon: CashIcon,
      },
      { area: "MEMBERS", path: "/members", label: "회원", icon: MembersIcon },
      { area: "SETTLEMENTS", path: "/settle", label: "정산", icon: SettleIcon },
    ],
  },
  {
    title: "콘텐츠",
    items: [
      {
        area: "NOTICES",
        path: "/notices",
        label: "공지사항",
        icon: NoticeIcon,
      },
      { area: "TERMS", path: "/terms", label: "약관·정책", icon: TermsIcon },
    ],
  },
  {
    title: "설정",
    items: [
      {
        area: "ADMINS",
        path: "/admins",
        label: "관리자 계정",
        icon: AdminsIcon,
      },
    ],
  },
];

export const ROLES: Record<AdminRole, { label: string; description: string }> =
  {
    SUPER: {
      label: "최고 관리자",
      description: "모든 메뉴와 관리자 계정을 관리해요",
    },
    OPS: {
      label: "운영 관리자",
      description: "가게·라이더 심사, 배달 관제, 회원, 공지, 약관을 관리해요",
    },
    FINANCE: {
      label: "정산 담당",
      description: "가게 충전금과 라이더 현금 수금, 정산을 처리해요",
    },
  };

/** 이 권한으로 들어갈 수 있는 첫 화면. */
export function homePath(areas: AdminArea[]): string {
  const first = MENU.flatMap((section) => section.items).find((item) =>
    areas.includes(item.area),
  );
  return first?.path ?? "/login";
}
