// ─── Product ────────────────────────────────────────────────────────────────
export interface IProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Order ──────────────────────────────────────────────────────────────────
export interface IOrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface IOrder {
  _id: string;
  customerId: string;
  items: IOrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

// ─── Events ─────────────────────────────────────────────────────────────────
export interface OrderCreatedEvent {
  orderId: string;
  customerId: string;
  items: IOrderItem[];
  totalAmount: number;
  createdAt: Date;
}

// ─── Service Response ───────────────────────────────────────────────────────
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
