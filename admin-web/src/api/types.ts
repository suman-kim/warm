// 서버 응답의 모양. backend의 *Result 클래스와 같다 (날짜는 ISO 문자열로 온다).

export type AdminRole = "SUPER" | "OPS" | "FINANCE";
export type AdminArea =
  | "REVIEW"
  | "ORDERS"
  | "MEMBERS"
  | "SETTLEMENTS"
  | "NOTICES"
  | "TERMS"
  | "ADMINS";
export type AdminStatus = "ACTIVE" | "INVITED" | "INACTIVE";

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminMe extends AdminAccount {
  areas: AdminArea[];
}

export interface AdminInvitation {
  name: string;
  email: string;
  expiresAt: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/** 라이더의 이동 수단. 지금은 오토바이뿐이다. */
export type VehicleType = "MOTORCYCLE";

// 라이더 심사
export type DriverStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DocumentType =
  "DRIVER_LICENSE" | "VEHICLE_REGISTRATION" | "DELIVERY_INSURANCE";
export type DocumentStatus =
  "SUBMITTED" | "APPROVED" | "REJECTED" | "NOT_SUBMITTED";

export interface DriverDocument {
  type: DocumentType;
  status: DocumentStatus;
  rejectionReason: string | null;
  uploadedAt: string | null;
  contentType: string | null;
  size: number | null;
  resubmitted: boolean;
}

export interface DriverApplication {
  id: string;
  userId: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  status: DriverStatus;
  rejectionReason: string | null;
  previousRejectionReason: string | null;
  resubmitted: boolean;
  appliedAt: string;
  reviewedAt: string | null;
  reviewerName: string | null;
  applicant: { name: string; phone: string; email: string } | null;
  documents: DriverDocument[];
}

export interface DriverApplicationPage extends Page<DriverApplication> {
  counts: Record<DriverStatus, number>;
}

// 주문 상태 (배달 관제)
export type OrderStatus =
  | "REQUESTED"
  | "ASSIGNED"
  | "DEPARTED"
  | "ARRIVED"
  | "PICKED_UP"
  | "DELIVERED"
  | "CANCELLED";

// 회원
export type MemberRole = "CUSTOMER" | "DRIVER";

export interface Member {
  id: string;
  role: MemberRole;
  name: string;
  email: string;
  phone: string;
  joinedAt: string;
  suspended: boolean;
  suspendedUntil: string | null;
  useCount: number;
  lastUsedAt: string | null;
}

export interface MemberPage extends Page<Member> {
  counts: Record<MemberRole, number>;
}

export interface Suspension {
  startedAt: string;
  days: number | null;
  reason: string;
  suspendedByName: string | null;
  inEffect: boolean;
  liftedAt: string | null;
}

export interface MemberDetail extends Member {
  activeDeliveries: number;
  suspensions: Suspension[];
}

// 정산
export type SettlementStatus =
  "WAITING" | "PAYING" | "PAID" | "FAILED" | "HOLD";

export interface Settlement {
  driverId: string;
  driverName: string;
  bankName: string | null;
  maskedAccountNumber: string | null;
  trips: number;
  gross: number;
  fee: number;
  /** 취소 보상 */
  compensation: number;
  net: number;
  status: SettlementStatus;
  /** 보류·실패 사유 */
  reason: string | null;
  paidAt: string | null;
}

export interface SettlementWeek {
  weekStart: string;
  weekEnd: string;
  payoutDate: string;
  commissionPercent: number;
  latest: boolean;
  items: Settlement[];
  totals: {
    drivers: number;
    gross: number;
    fee: number;
    compensation: number;
    unpaidNet: number;
  };
}

/** 지급 처리 결과. */
export interface PayoutBatch {
  requestedAt: string;
  requested: number;
  paid: number;
  processing: number;
  failures: { driverId: string; driverName: string; reason: string }[];
  week: SettlementWeek;
}

export interface Payout {
  id: string;
  paidAt: string;
  driverName: string;
  weekStart: string;
  weekEnd: string;
  bankName: string;
  maskedAccountNumber: string;
  amount: number;
  status: "REQUESTED" | "PAID" | "FAILED";
  failureReason: string | null;
  paidByName: string | null;
}

// 공지
export type NoticeAudience = "ALL" | "CUSTOMER" | "DRIVER";

export interface Notice {
  id: string;
  title: string;
  body: string;
  audience: NoticeAudience;
  publishedAt: string;
  authorName: string | null;
  removedAt: string | null;
}

export interface NoticePage extends Page<Notice> {
  counts: { live: number; removed: number };
}

// 약관
export type LegalType =
  "TERMS" | "REFUND" | "PRIVACY" | "LOCATION" | "DRIVER" | "MARKETING";
export type LegalStatus = "CURRENT" | "SCHEDULED" | "PAST";

export interface LegalDocument {
  id: string;
  type: LegalType;
  version: string;
  title: string;
  body: string;
  effectiveAt: string;
  createdAt: string;
  createdByName: string | null;
  status: LegalStatus;
}

// 가게 심사·충전금
export type StoreStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface StoreAddress {
  address: string;
  detailAddress: string | null;
  sigungu: string;
  dong: string;
  latitude: number;
  longitude: number;
}

export interface AdminStore {
  id: string;
  name: string;
  /** 숫자 10자리 */
  businessNumber: string;
  phone: string;
  address: StoreAddress;
  status: StoreStatus;
  rejectionReason: string | null;
  walletBalance: number;
  appliedAt: string;
  reviewedAt: string | null;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
}

export interface StorePage extends Page<AdminStore> {
  counts: Record<StoreStatus, number>;
}

export type WalletEntryKind =
  "TOP_UP" | "DELIVERY_FEE" | "REFUND" | "ADJUSTMENT";

export interface WalletEntry {
  id: string;
  kind: WalletEntryKind;
  /** 들어오면 +, 나가면 − (원) */
  amount: number;
  balanceAfter: number;
  orderId: string | null;
  memo: string | null;
  createdAt: string;
}

export interface Wallet extends Page<WalletEntry> {
  balance: number;
}

export interface StoreWalletItem {
  storeId: string;
  name: string;
  balance: number;
  todayTopUps: number;
  todayFees: number;
  lastEntryKind: WalletEntryKind | null;
  lastEntryAt: string | null;
  low: boolean;
}

export interface StoreWalletOverview {
  totalBalance: number;
  lowBalanceCount: number;
  todayTopUps: number;
  items: StoreWalletItem[];
}

// 배달 관제
export type DoorPayment = "PREPAID" | "CASH" | "CARD";
export type DeliveryFlag = "DISPATCH_LATE" | "PICKUP_LATE";

export interface DeliveryMonitorItem {
  id: string;
  code: string;
  requestedAt: string;
  status: OrderStatus;
  storeName: string;
  customerArea: string;
  elapsedMinutes: number;
  riderName: string | null;
  doorPayment: DoorPayment;
  foodAmount: number;
  flag: DeliveryFlag | null;
}

export interface DeliveryMonitor {
  summary: {
    searching: number;
    toStore: number;
    atStore: number;
    delivering: number;
    dispatchLate: number;
    pickupLate: number;
  };
  items: DeliveryMonitorItem[];
}

// 라이더 현금 수금
export interface RiderCashItem {
  orderId: string;
  code: string;
  deliveredAt: string;
  riderName: string | null;
  storeName: string;
  collectedAmount: number;
  foodAmount: number;
  handedAt: string | null;
}

export interface RiderCash {
  summary: {
    date: string;
    total: number;
    handed: number;
    pending: number;
    pendingCount: number;
    count: number;
  };
  items: RiderCashItem[];
}
