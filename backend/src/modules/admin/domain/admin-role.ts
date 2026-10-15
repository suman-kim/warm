/** 운영자 권한. 운영자 웹에서 볼 수 있는 메뉴가 권한마다 다르다. */
export enum AdminRole {
  /** 최고 관리자 — 모든 메뉴와 관리자 계정 */
  SUPER = 'SUPER',
  /** 운영 관리자 — 기사 심사, 주문, 회원, 공지, 약관 */
  OPS = 'OPS',
  /** 정산 담당 — 주문 현황, 정산 */
  FINANCE = 'FINANCE',
}

/** 운영자 웹의 업무 영역(메뉴). API마다 어느 영역인지 표시해 권한을 확인한다. */
export enum AdminArea {
  REVIEW = 'REVIEW',
  ORDERS = 'ORDERS',
  MEMBERS = 'MEMBERS',
  SETTLEMENTS = 'SETTLEMENTS',
  NOTICES = 'NOTICES',
  TERMS = 'TERMS',
  ADMINS = 'ADMINS',
}

const AREAS_BY_ROLE: Readonly<Record<AdminRole, readonly AdminArea[]>> = {
  [AdminRole.SUPER]: Object.values(AdminArea),
  [AdminRole.OPS]: [
    AdminArea.REVIEW,
    AdminArea.ORDERS,
    AdminArea.MEMBERS,
    AdminArea.NOTICES,
    AdminArea.TERMS,
  ],
  [AdminRole.FINANCE]: [AdminArea.ORDERS, AdminArea.SETTLEMENTS],
};

/** 이 권한으로 쓸 수 있는 영역. */
export function areasOf(role: AdminRole): readonly AdminArea[] {
  return AREAS_BY_ROLE[role];
}
