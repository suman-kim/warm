import { api } from "./client";
import type {
  DeliveryDestination,
  DeliveryQuote,
  DoorPayment,
  FoundAddress,
  Order,
  OrderDetail,
  OrderStatus,
  Page,
  Session,
  Store,
  StoreAddress,
  Tracking,
  User,
  Wallet,
  WalletEntry,
} from "./types";

export const authApi = {
  login: (email: string, password: string) =>
    api.post<Session>("/auth/login", { email, password }, { auth: false }),
  logout: (refreshToken: string) =>
    api.post<null>("/auth/logout", { refreshToken }, { auth: false }),
  me: () => api.get<User>("/users/me"),
};

export const storeApi = {
  mine: () => api.get<Store>("/stores/me"),
  update: (input: {
    name: string;
    businessNumber: string;
    phone: string;
    address: StoreAddress;
  }) => api.put<Store>("/stores/me", input),
  wallet: (page = 1, size = 100) =>
    api.get<Wallet>("/stores/me/wallet", { page, size }),
  topUp: (amount: number) =>
    api.post<WalletEntry>("/stores/me/wallet/top-ups", { amount }),
};

export const deliveryApi = {
  quote: (dropoff: DeliveryDestination) =>
    api.post<DeliveryQuote>("/deliveries/quotes", { dropoff }),
  request: (input: {
    dropoff: DeliveryDestination & { phone: string };
    foodAmount: number;
    doorPayment: DoorPayment;
    readyInMinutes: number;
    memo?: string;
  }) => api.post<Order>("/deliveries", input),
};

export const ordersApi = {
  list: (query: {
    status?: OrderStatus;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  }) =>
    api.get<Page<Order>>("/orders", {
      status: query.status,
      from: query.from,
      to: query.to,
      page: query.page ?? 1,
      size: query.size ?? 100,
    }),
  get: (id: string) => api.get<OrderDetail>(`/orders/${id}`),
  tracking: (id: string) => api.get<Tracking>(`/orders/${id}/tracking`),
  cancel: (id: string, reason: string) =>
    api.post<Order>(`/orders/${id}/cancel`, { reason }),
};

export const addressApi = {
  search: (query: string) =>
    api.get<FoundAddress[]>("/address-search", { query }),
};
