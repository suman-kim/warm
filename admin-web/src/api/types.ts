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

export type VehicleType =
  "MOTORCYCLE" | "DAMAS" | "LABO" | "TRUCK_1T" | "TRUCK_2_5T" | "TRUCK_5T";

// 기사 심사
export type DriverStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DocumentType =
  "DRIVER_LICENSE" | "VEHICLE_REGISTRATION" | "FREIGHT_QUALIFICATION";
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

// 주문 현황
export type OrderStatus =
  | "REQUESTED"
  | "PAYING"
  | "PAYMENT_FAILED"
  | "ASSIGNED"
  | "DEPARTED"
  | "ARRIVED"
  | "PICKED_UP"
  | "DELIVERED"
  | "CANCELLED"
  | "NO_SHOW";

export type PaymentStatus =
  "UNPAID" | "PAID" | "FAILED" | "PARTIALLY_REFUNDED" | "REFUNDED";

/** 주문 현황의 결제 탭. REFUND는 일부·전액 환불을 함께 본다. */
export type PaymentFilter = "UNPAID" | "PAID" | "FAILED" | "REFUND";

export interface OrderSummary {
  date: string;
  total: number;
  counts: Record<OrderStatus, number>;
  paymentCounts: Record<PaymentFilter, number>;
  paidAmount: number;
  refundedAmount: number;
  /** 결제한 금액 − 환불한 금액 */
  revenue: number;
}

export interface OrderRow {
  id: string;
  code: string;
  requestedAt: string;
  vehicleType: VehicleType;
  pickupArea: string;
  dropoffArea: string;
  distanceKm: number;
  customerName: string | null;
  driverName: string | null;
  fare: number;
  /** 최종 요금 (추가 요금·대기료 포함) */
  totalFare: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  refundedAmount: number;
}

export type LoadingHelp = "NONE" | "TOGETHER" | "DRIVER_ONLY";
export type CardType = "CREDIT" | "CHECK";

export interface PaymentCard {
  brand: string;
  last4: string;
  type: CardType;
}

export interface Charge {
  id: string;
  kind: "DISPATCH" | "ADDITIONAL";
  amount: number;
  status: "PAID" | "FAILED" | "PARTIALLY_CANCELLED" | "CANCELLED";
  card: PaymentCard;
  approvalNumber: string | null;
  approvedAt: string | null;
  failure: { code: string; title: string; guidance: string } | null;
  failedAt: string | null;
  cancelledAmount: number;
  cancelledAt: string | null;
}

export interface Refund {
  amount: number;
  reason: string;
  refundedByName: string | null;
  automatic: boolean;
  refundedAt: string;
}

export interface FloorAccess {
  floor: number;
  elevator: boolean;
}

/** 주문 상세 (운영자용). */
export interface AdminOrderDetail {
  id: string;
  code: string;
  status: OrderStatus;
  vehicleType: VehicleType;
  pickup: { address: string; dong: string | null; sigungu: string | null };
  dropoff: { address: string; dong: string | null; sigungu: string | null };
  distanceKm: number;
  baseFare: number;
  loadingHelp: LoadingHelp;
  helpFee: number;
  pickupAccess: FloorAccess;
  dropoffAccess: FloorAccess;
  stairFee: number;
  fare: number;
  extraItems: { overload: number; bulky: number; stairs: number };
  extraFee: number;
  waitingMinutes: number;
  waitingFee: number;
  totalFare: number;
  cancellationFee: number;
  paymentFailure: { code: string; title: string; guidance: string } | null;
  requestedAt: string;
  assignedAt: string | null;
  departedAt: string | null;
  arrivedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  noShowAt: string | null;
  cancelReason: string | null;
  customer: { id: string; name: string | null; phone: string | null };
  driver: {
    id: string;
    name: string;
    phone: string;
    vehicleNumber: string;
  } | null;
  payment: {
    status: PaymentStatus;
    card: PaymentCard | null;
    paidAmount: number;
    refundedAmount: number;
    refundableAmount: number;
    unpaidAmount: number;
    charges: Charge[];
    refunds: Refund[];
  };
}

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
  rating: number | null;
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
  /** 그중 추가 요금과 대기료 */
  extraFare: number;
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
