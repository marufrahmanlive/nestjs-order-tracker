# Order Tracker System — NestJS Microservices Monorepo

A production-style NestJS monorepo implementing an Order Tracker System using microservices architecture.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (HTTP)                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY :3000                             │
│              (NestJS HTTP + Pino Logger)                         │
│         No DB access. Routes via TCP only.                       │
└──────────────┬──────────────────────┬───────────────────────────┘
               │ TCP                  │ TCP
               ▼                      ▼
┌──────────────────────┐  ┌───────────────────────────────────────┐
│  PRODUCT SERVICE     │  │         ORDER SERVICE :3002            │
│      :3001           │◄─┤  (TCP + RabbitMQ Publisher)           │
│  MongoDB + Redis     │  │  MongoDB                               │
│  Cache L1+L2         │  │  Calls Product Service via TCP         │
└──────────────────────┘  └──────────────────┬──────────────────  ┘
                                             │ RabbitMQ publish
                                             ▼
                          ┌─────────────────────────────────────── ┐
                          │        WORKER SERVICE                   │
                          │  (RabbitMQ Consumer)                    │
                          │  Handles: notifications, analytics      │
                          └─────────────────────────────────────── ┘

Infrastructure:
  MongoDB  :27017   — data persistence
  Redis    :6379    — L2 cache (product list + by id)
  RabbitMQ :5672    — async event bus
             :15672  — management UI
```

---

## Project Structure

```
order-tracker/
├── apps/
│   ├── api-gateway/           # HTTP REST API (port 3000)
│   │   └── src/
│   │       ├── products/      # Products controller
│   │       ├── orders/        # Orders controller
│   │       ├── api-gateway.module.ts
│   │       └── main.ts
│   │
│   ├── product-service/       # TCP Microservice (port 3001)
│   │   └── src/
│   │       ├── schemas/       # MongoDB schema
│   │       ├── product.controller.ts
│   │       ├── product.service.ts
│   │       ├── product-service.module.ts
│   │       └── main.ts
│   │
│   ├── order-service/         # TCP Microservice (port 3002)
│   │   └── src/
│   │       ├── schemas/       # MongoDB schema
│   │       ├── order.controller.ts
│   │       ├── order.service.ts
│   │       ├── order-service.module.ts
│   │       └── main.ts
│   │
│   └── worker-service/        # RabbitMQ Consumer
│       └── src/
│           ├── worker.controller.ts
│           ├── worker.service.ts
│           ├── worker-service.module.ts
│           └── main.ts
│
├── libs/
│   └── common/                # Shared library
│       └── src/
│           ├── dto/
│           │   ├── product.dto.ts    # CreateProductDto, ReduceStockDto
│           │   └── order.dto.ts      # CreateOrderDto, OrderItemDto
│           ├── interfaces/
│           │   └── index.ts          # IProduct, IOrder, OrderCreatedEvent...
│           ├── constants/
│           │   └── index.ts          # TCP patterns, queue names, cache keys
│           └── index.ts              # Barrel export
│
├── docker-compose.yml
├── nest-cli.json
├── tsconfig.json
├── package.json
└── .env.example
```

---

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm

---

## Step 1 — Install Dependencies

```bash
npm install
```

---

## Step 2 — Start Infrastructure (Docker)

```bash
# Start MongoDB, Redis, RabbitMQ
docker-compose up mongodb redis rabbitmq -d

# Verify health
docker-compose ps
```

Services available:

- **MongoDB**: `mongodb://root:rootpassword@localhost:27017`
- **Redis**: `redis://localhost:6379`
- **RabbitMQ**: `amqp://guest:guest@localhost:5672`
- **RabbitMQ UI**: http://localhost:15672 (guest/guest)

---

## Step 3 — Configure Environment

```bash
cp .env.example .env
# Edit .env if needed (defaults work with docker-compose)
```

---

## Step 4 — Run Services (Development)

Open 4 terminals:

```bash
# Terminal 1 — Product Service
npm run start:product-service:dev

# Terminal 2 — Order Service
npm run start:order-service:dev

# Terminal 3 — Worker Service
npm run start:worker-service:dev

# Terminal 4 — API Gateway
npm run start:api-gateway:dev
```

---

## Step 5 — Run with Docker Compose (Production)

```bash
docker-compose up --build
```

---

## API Reference

Base URL: `http://localhost:3000/api/v1`

### Products

#### Create Product

```http
POST /api/v1/products
Content-Type: application/json

{
  "name": "Mechanical Keyboard",
  "description": "TKL 80% keyboard with Cherry MX switches",
  "price": 149.99,
  "stock": 50
}
```

#### Get All Products

```http
GET /api/v1/products
```

#### Get Product by ID

```http
GET /api/v1/products/:id
```

### Orders

#### Create Order

```http
POST /api/v1/orders
Content-Type: application/json

{
  "customerId": "customer_abc123",
  "items": [
    { "productId": "<product-id>", "quantity": 2 },
    { "productId": "<product-id-2>", "quantity": 1 }
  ]
}
```

#### Get All Orders

```http
GET /api/v1/orders
```

#### Get Order by ID

```http
GET /api/v1/orders/:id
```

---

## Order Flow (Step-by-step)

```
POST /api/v1/orders
        │
        ▼
  API Gateway
  (HTTP → TCP)
        │
        ▼
  Order Service ──── TCP ──►  Product Service
  Step 1: Validate stock      (findOne per item)
  Step 2: Reduce stock ──────► (reduceStock + cache invalidation)
  Step 3: Save order (MongoDB)
  Step 4: Emit "order.created" ──► RabbitMQ
        │
        ▼
  Worker Service (RabbitMQ Consumer)
  - Send notification (simulated)
  - Track analytics (simulated)
  - ACK message
```

---

## Caching Strategy (Redis + In-Memory L1)

Two-layer cache implemented in Product Service:

| Layer | Backend       | TTL     | Purpose                  |
| ----- | ------------- | ------- | ------------------------ |
| L1    | In-memory LRU | 30s     | Ultra-fast local cache   |
| L2    | Redis         | 60-120s | Shared distributed cache |

Cache keys:

- `products:all` — all products list (TTL: 60s)
- `products:{id}` — single product (TTL: 120s)

Cache is **invalidated** on:

- Product create → `products:all` deleted
- Stock reduction → `products:{id}` + `products:all` deleted

---

## Logging (Pino)

All services use structured JSON logging via `nestjs-pino`:

**API Gateway** logs:

- Every HTTP request with method, URL, status, response time
- TCP dispatch and response for each upstream call

**Product Service** logs:

- Cache HITs and MISSes
- CRUD operations with productId
- Stock operations with before/after values

**Order Service** logs:

- Full order flow steps (1–4)
- TCP calls to Product Service
- RabbitMQ publish confirmation

**Worker Service** logs:

- Event receipt with orderId, customerId
- Each async task (notification, analytics)
- Message ACK/NACK

Development: pretty-printed with colors via `pino-pretty`
Production: JSON format for log aggregators (Datadog, CloudWatch, ELK)

---

## Communication Patterns

| From           | To              | Protocol       | When                         |
| -------------- | --------------- | -------------- | ---------------------------- |
| Client         | API Gateway     | HTTP REST      | All API calls                |
| API Gateway    | Product Service | TCP            | Product CRUD                 |
| API Gateway    | Order Service   | TCP            | Order creation/query         |
| Order Service  | Product Service | TCP            | Validate stock, reduce stock |
| Order Service  | RabbitMQ        | AMQP (publish) | After order saved            |
| Worker Service | RabbitMQ        | AMQP (consume) | Process order.created events |

---

## TCP Message Patterns

Defined in `libs/common/src/constants/index.ts`:

```typescript
PRODUCT_PATTERNS = {
  CREATE: 'product.create',
  FIND_ALL: 'product.findAll',
  FIND_ONE: 'product.findOne',
  REDUCE_STOCK: 'product.reduceStock',
};

ORDER_PATTERNS = {
  CREATE: 'order.create',
  FIND_ALL: 'order.findAll',
  FIND_ONE: 'order.findOne',
};
```

---

## Shared Library Usage

Import shared code from `@app/common` in any service:

```typescript
import {
  CreateProductDto, // DTO with class-validator decorators
  CreateOrderDto, // DTO with nested validation
  PRODUCT_PATTERNS, // TCP message pattern constants
  CACHE_KEYS, // Redis key generators
  IProduct, // TypeScript interfaces
  OrderCreatedEvent, // RabbitMQ event shape
  OrderStatus, // Enum: PENDING | CONFIRMED | FAILED
} from '@app/common';
```

---

## Production Considerations

1. **Dead Letter Queue (DLQ)**: Add DLQ for Worker nack'd messages
2. **Circuit Breaker**: Add `nestjs-resilience` for TCP client calls
3. **Health Checks**: Add `@nestjs/terminus` health endpoints
4. **API Authentication**: Add JWT guard to API Gateway
5. **Rate Limiting**: Add `@nestjs/throttler` to API Gateway
6. **Monitoring**: Integrate Prometheus + Grafana metrics
7. **Distributed Tracing**: Add OpenTelemetry
8. **Secrets Management**: Use Vault or AWS Secrets Manager for credentials
