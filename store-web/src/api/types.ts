// 서버가 주고받는 모양. 가게 앱(Flutter)의 movo_api 모델과 같은 필드를 쓴다.

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface User {
  id: string;
  role: "CUSTOMER" | "DRIVER" | "ADMIN";
  name: string;
  email: string;
  phone: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type StoreStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface StoreAddress {
  address: string;
  detailAddress: string | null;
  sigungu: string;
  dong: string;
  latitude: number;
  longitude: number;
}

export interface Store {
  id: string;
  name: string;
  businessNumber: string;
  phone: string;
  address: StoreAddress;
  status: StoreStatus;
  rejectionReason: string | null;
  walletBalance: number;
  appliedAt: string;
  reviewedAt: string | null;
}

export type WalletEntryKind =
  "TOP_UP" | "DELIVERY_FEE" | "REFUND" | "ADJUSTMENT";

export interface WalletEntry {
  id: string;
  kind: WalletEntryKind;
  amount: number;
  balanceAfter: number;
  orderId: string | null;
  memo: string | null;
  createdAt: string;
}

export interface Wallet extends Page<WalletEntry> {
  balance: number;
}

export type DoorPayment = "PREPAID" | "CASH" | "CARD";

export type OrderStatus =
  | "REQUESTED"
  | "ASSIGNED"
  | "DEPARTED"
  | "ARRIVED"
  | "PICKED_UP"
  | "DELIVERED"
  | "CANCELLED";

export interface Waypoint {
  address: string;
  detailAddress: string | null;
  sigungu: string | null;
  dong: string | null;
  latitude: number;
  longitude: number;
  contactName: string;
  contactPhone: string;
}

export interface StoreDelivery {
  storeId: string;
  foodAmount: number;
  doorPayment: DoorPayment;
  readyAt: string | null;
  collectedMethod: "CASH" | "CARD" | null;
  collectedAmount: number | null;
}

export interface Order {
  id: string;
  code: string;
  status: OrderStatus;
  pickup: Waypoint;
  dropoff: Waypoint;
  storeDelivery: StoreDelivery | null;
  memo: string | null;
  distanceKm: number;
  durationMinutes: number;
  /** 배달대행료 */
  fare: number;
  /** 취소했으면 낸 수수료 */
  cancellationFee: number;
  /** 지금 취소하면 내는 수수료. 취소할 수 없으면 null. */
  cancellationFeeNow: number | null;
  driverName?: string | null;
  estimatedPickupAt: string | null;
  estimatedDeliveryAt: string | null;
  requestedAt: string;
  assignedAt: string | null;
  arrivedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface AssignedDriver {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehicleNumber: string;
}

export interface OrderDetail extends Order {
  driver: AssignedDriver | null;
}

export interface Tracking {
  status: OrderStatus;
  driverLocation: { latitude: number; longitude: number } | null;
  estimatedPickupAt: string | null;
  estimatedDeliveryAt: string | null;
}

export interface FoundAddress {
  address: string;
  detail: string | null;
  sigungu: string | null;
  dong: string | null;
  latitude: number;
  longitude: number;
}

export interface DeliveryQuote {
  distanceKm: number;
  durationMinutes: number;
  fee: number;
  walletBalance: number;
}

export interface DeliveryDestination {
  address: string;
  detailAddress?: string;
  sigungu?: string;
  dong?: string;
  latitude: number;
  longitude: number;
}
