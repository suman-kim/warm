import { api } from "./client";
import type {
  AdminOrderDetail,
  PaymentFilter,
  PayoutBatch,
  AdminAccount,
  AdminInvitation,
  AdminMe,
  AdminRole,
  DocumentType,
  DriverApplication,
  DriverApplicationPage,
  DriverStatus,
  LegalDocument,
  LegalType,
  MemberDetail,
  MemberPage,
  MemberRole,
  Notice,
  NoticeAudience,
  NoticePage,
  OrderRow,
  OrderStatus,
  OrderSummary,
  Page,
  Payout,
  Session,
  SettlementWeek,
} from "./types";

/** 한 번에 받는 줄 수 (서버가 받는 가장 큰 값). 더 있으면 '더 보기'로 이어 받는다. */
export const PAGE_SIZE = 100;

export const authApi = {
  login: (email: string, password: string) =>
    api.post<Session>("/auth/login", { email, password }, { auth: false }),
  logout: (refreshToken: string) =>
    api.post<null>("/auth/logout", { refreshToken }, { auth: false }),
  invitation: (token: string) =>
    api.get<AdminInvitation>(
      `/auth/admin-invitations/${encodeURIComponent(token)}`,
    ),
  acceptInvitation: (token: string, password: string) =>
    api.post<Session>(
      `/auth/admin-invitations/${encodeURIComponent(token)}/accept`,
      { password },
      { auth: false },
    ),
  me: () => api.get<AdminMe>("/admin/me"),
};

export const reviewApi = {
  list: (status: DriverStatus, q: string, page: number) =>
    api.get<DriverApplicationPage>("/admin/drivers", {
      status,
      q: q.trim() || undefined,
      page,
      size: PAGE_SIZE,
    }),
  detail: (id: string) => api.get<DriverApplication>(`/admin/drivers/${id}`),
  approve: (id: string) =>
    api.patch<DriverApplication>(`/admin/drivers/${id}/approve`),
  reject: (id: string, reason: string, rejectedDocuments: DocumentType[]) =>
    api.patch<DriverApplication>(`/admin/drivers/${id}/reject`, {
      reason,
      rejectedDocuments,
    }),
  documentFile: (id: string, type: DocumentType) =>
    api.blob(`/admin/drivers/${id}/documents/${type}/file`),
};

export const ordersApi = {
  summary: (date: string) =>
    api.get<OrderSummary>("/admin/orders/summary", { date }),
  list: (
    date: string,
    statuses: OrderStatus[] | undefined,
    payment: PaymentFilter | undefined,
    page: number,
  ) =>
    api.get<Page<OrderRow>>("/admin/orders", {
      date,
      status: statuses?.join(","),
      payment,
      page,
      size: PAGE_SIZE,
    }),
  detail: (id: string) => api.get<AdminOrderDetail>(`/admin/orders/${id}`),
  refund: (id: string, amount: number, reason: string) =>
    api.post<AdminOrderDetail>(`/admin/orders/${id}/refunds`, {
      amount,
      reason,
    }),
};

export const membersApi = {
  list: (
    role: MemberRole,
    q: string,
    status: "ACTIVE" | "SUSPENDED" | undefined,
    page: number,
  ) =>
    api.get<MemberPage>("/admin/users", {
      role,
      q: q.trim() || undefined,
      status,
      page,
      size: PAGE_SIZE,
    }),
  detail: (id: string) => api.get<MemberDetail>(`/admin/users/${id}`),
  suspend: (id: string, days: number | null, reason: string) =>
    api.post<MemberDetail>(`/admin/users/${id}/suspensions`, { days, reason }),
  unsuspend: (id: string) =>
    api.delete<MemberDetail>(`/admin/users/${id}/suspensions/current`),
};

export const settlementsApi = {
  week: (weekStart?: string) =>
    api.get<SettlementWeek>("/admin/settlements", { weekStart }),
  pay: (weekStart: string, driverIds: string[]) =>
    api.post<PayoutBatch>("/admin/settlements/payouts", {
      weekStart,
      driverIds,
    }),
  payouts: (page: number) =>
    api.get<Page<Payout>>("/admin/payouts", { page, size: PAGE_SIZE }),
};

export const noticesApi = {
  list: (state: "LIVE" | "REMOVED", page: number) =>
    api.get<NoticePage>("/admin/notices", { state, page, size: PAGE_SIZE }),
  publish: (input: { audience: NoticeAudience; title: string; body: string }) =>
    api.post<Notice>("/admin/notices", input),
  remove: (id: string) => api.delete<null>(`/admin/notices/${id}`),
};

export const legalApi = {
  list: () => api.get<LegalDocument[]>("/admin/legal-documents"),
  publish: (input: {
    type: LegalType;
    version: string;
    title: string;
    body: string;
    effectiveAt: string;
  }) => api.post<LegalDocument>("/admin/legal-documents", input),
};

export const adminsApi = {
  list: () => api.get<AdminAccount[]>("/admin/admins"),
  invite: (input: { name: string; email: string; role: AdminRole }) =>
    api.post<AdminAccount>("/admin/admins", input),
  update: (id: string, input: { role?: AdminRole; active?: boolean }) =>
    api.patch<AdminAccount>(`/admin/admins/${id}`, input),
  resendInvitation: (id: string) =>
    api.post<null>(`/admin/admins/${id}/invitations`),
};
