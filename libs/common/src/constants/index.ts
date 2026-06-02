// ─── TCP Message Patterns ────────────────────────────────────────────────────
export const PRODUCT_PATTERNS = {
  CREATE: 'product.create',
  FIND_ALL: 'product.findAll',
  FIND_ONE: 'product.findOne',
  REDUCE_STOCK: 'product.reduceStock',
} as const;

export const ORDER_PATTERNS = {
  CREATE: 'order.create',
  FIND_ALL: 'order.findAll',
  FIND_ONE: 'order.findOne',
} as const;

export const AUTH_PATTERNS = {
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',
  VALIDATE_USER: 'auth.validateUser',
  FIND_BY_ID: 'auth.findById',
  FIND_BY_EMAIL: 'auth.findByEmail',
  REFRESH_TOKEN: 'auth.refreshToken',
} as const;

export const USER_PATTERNS = {
  CREATE: 'user.create',
  FIND_ALL: 'user.findAll',
  FIND_ONE: 'user.findOne',
  UPDATE: 'user.update',
  SOFT_DELETE: 'user.softDelete',
} as const;

// ─── RabbitMQ ────────────────────────────────────────────────────────────────
export const RABBITMQ_EXCHANGES = {
  ORDER_EVENTS: 'order_events',
} as const;

export const RABBITMQ_QUEUES = {
  ORDER_CREATED: 'order.created',
  ORDER_NOTIFICATIONS: 'order.notifications',
} as const;

export const RABBITMQ_ROUTING_KEYS = {
  ORDER_CREATED: 'order.created',
} as const;

// ─── Service Names (for NestJS injection tokens) ─────────────────────────────
export const SERVICES = {
  PRODUCT: 'PRODUCT_SERVICE',
  ORDER: 'ORDER_SERVICE',
  AUTH: 'AUTH_SERVICE',
  USER: 'USER_SERVICE',
} as const;

// ─── Cache Keys ──────────────────────────────────────────────────────────────
export const CACHE_KEYS = {
  ALL_PRODUCTS: 'products:all',
  PRODUCT_BY_ID: (id: string) => `products:${id}`,
} as const;

export const CACHE_TTL = {
  PRODUCTS: 60, // 60 seconds
  PRODUCT_BY_ID: 120, // 120 seconds
} as const;

// ─── Error Codes ─────────────────────────────────────────────────────────────
export * from './error-codes.constants';
export * from './auth.constants';
