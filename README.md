# Order Tracker

A production-ready **microservices-based order tracking system** built with NestJS. Features JWT authentication, role-based access control, event-driven architecture with RabbitMQ, Redis caching, and MongoDB persistence.

---

## 📋 Table of Contents

- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Services Overview](#-services-overview)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Running the Project](#-running-the-project)
- [API Documentation (Swagger)](#-api-documentation-swagger)
- [API Endpoints](#-api-endpoints)
- [Authentication & Authorization](#-authentication--authorization)
- [Service Communication](#-service-communication)
- [Creating an Admin User](#-creating-an-admin-user)
- [Project Structure](#-project-structure)
- [NPM Scripts](#-npm-scripts)
- [Docker Compose](#-docker-compose)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)

---

## 🏗 Architecture

```
                    ┌──────────────┐
                    │   Client     │
                    │ (Browser/App)│
                    └──────┬───────┘
                           │ HTTP (REST)
                           ▼
                 ┌──────────────────┐
                 │   API Gateway    │  ← Swagger UI: /api/docs
                 │   Port :3000     │     JWT Auth, Role Guards
                 └───┬───┬───┬──────┘
                     │   │   │  TCP (NestJS Microservices)
          ┌──────────┘   │   └──────────────┐
          ▼              ▼                  ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │  Product Svc │ │  Order Svc   │ │  Auth Svc    │
  │  Port :3001  │ │  Port :3002  │ │  Port :3003  │
  │              │ │              │ │              │
  │  MongoDB     │ │  MongoDB     │ │  MongoDB     │
  │  Redis Cache │ │  RabbitMQ ───┼─┼─► publishes  │
  └──────────────┘ │  publisher   │ │  JWT signing │
                   └──────┬───────┘ └──────────────┘
                          │ RabbitMQ (order.created)
                          ▼
                   ┌──────────────┐ ┌──────────────┐
                   │ Worker Svc   │ │  User Svc    │
                   │              │ │  Port :3004  │
                   │ Notifications│ │              │
                   │ Analytics    │ │  MongoDB     │
                   └──────────────┘ └──────────────┘
```

### Communication Patterns

| Pattern       | Used Between                   | Purpose                             |
| ------------- | ------------------------------ | ----------------------------------- |
| **HTTP/REST** | Client → API Gateway           | External API access                 |
| **TCP**       | API Gateway → All Services     | Internal microservice communication |
| **RabbitMQ**  | Order Service → Worker Service | Async event-driven processing       |

---

## 💻 Technology Stack

| Category              | Technology                           |
| --------------------- | ------------------------------------ |
| **Framework**         | NestJS 11 (Monorepo)                 |
| **Language**          | TypeScript 5.7                       |
| **Runtime**           | Node.js 20+                          |
| **Database**          | MongoDB 7.0 (Mongoose ODM)           |
| **Cache**             | Redis 7.2 (Keyv + @keyv/redis)       |
| **Message Broker**    | RabbitMQ 3.13 (amqplib)              |
| **Authentication**    | Passport.js (JWT + Local strategies) |
| **Password Hashing**  | bcrypt (12 rounds)                   |
| **API Documentation** | Swagger / OpenAPI 3.0                |
| **Validation**        | class-validator + class-transformer  |
| **Logging**           | Pino (nestjs-pino)                   |
| **Containerization**  | Docker + Docker Compose              |
| **Package Manager**   | npm                                  |

---

## 📦 Services Overview

| Service             | Port | Transport    | Responsibilities                                                |
| ------------------- | ---- | ------------ | --------------------------------------------------------------- |
| **api-gateway**     | 3000 | HTTP Server  | JWT auth, role guards, request routing, Swagger UI              |
| **auth-service**    | 3003 | TCP          | User registration, login, JWT signing, refresh token rotation   |
| **user-service**    | 3004 | TCP          | User CRUD, soft-delete, paginated listing                       |
| **product-service** | 3001 | TCP          | Product CRUD, stock management, Redis caching                   |
| **order-service**   | 3002 | TCP + RMQ    | Order creation with stock validation, RabbitMQ event publishing |
| **worker-service**  | —    | RMQ Consumer | Async order processing: notifications, analytics                |

---

## 🔧 Prerequisites

- **Node.js** 20+ (recommended: 22 LTS)
- **npm** 10+
- **Docker** & **Docker Compose** (for infrastructure)
- **Git**

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <repository-url>
cd order-tracker
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

The default `.env` values work with local Docker infrastructure — no changes needed.

### 3. Start Infrastructure (MongoDB + Redis + RabbitMQ)

```bash
docker-compose up -d
```

Verify all containers are healthy:

```bash
docker-compose ps
```

### 4. Run All Services

```bash
npm run start:all:dev
```

This single command starts all 6 services concurrently in **watch mode** (auto-reload on code changes).

**Services will be available at:**

- 🚀 API Gateway: http://localhost:3000/api/v1
- 📖 Swagger UI: http://localhost:3000/api/docs
- 🐇 RabbitMQ Management: http://localhost:15672 (guest/guest)

---

## 🔐 Environment Variables

| Variable             | Default                                                                      | Description                       |
| -------------------- | ---------------------------------------------------------------------------- | --------------------------------- |
| `PORT`               | `3000`                                                                       | API Gateway HTTP port             |
| `NODE_ENV`           | `development`                                                                | Environment mode                  |
| `MONGODB_URI`        | `mongodb://root:rootpassword@localhost:27017/order_tracker?authSource=admin` | MongoDB connection string         |
| `REDIS_HOST`         | `localhost`                                                                  | Redis host                        |
| `REDIS_PORT`         | `6379`                                                                       | Redis port                        |
| `RABBITMQ_URL`       | `amqp://guest:guest@localhost:5672`                                          | RabbitMQ connection URL           |
| `JWT_ACCESS_SECRET`  | _(change in production)_                                                     | Secret for signing access tokens  |
| `JWT_REFRESH_SECRET` | _(change in production)_                                                     | Secret for signing refresh tokens |
| `JWT_ACCESS_EXPIRY`  | `15m`                                                                        | Access token lifetime             |
| `JWT_REFRESH_EXPIRY` | `7d`                                                                         | Refresh token lifetime            |
| `BCRYPT_ROUNDS`      | `12`                                                                         | bcrypt hashing rounds             |

---

## 🏃 Running the Project

### All Services at Once (Recommended)

```bash
npm run start:all:dev          # Development mode with hot-reload
```

### Individual Services

```bash
npm run start:api-gateway:dev      # API Gateway (Port 3000)
npm run start:auth-service:dev     # Auth Service (Port 3003)
npm run start:user-service:dev     # User Service (Port 3004)
npm run start:product-service:dev  # Product Service (Port 3001)
npm run start:order-service:dev    # Order Service (Port 3002)
npm run start:worker-service:dev   # Worker Service (RabbitMQ consumer)
```

### Via Docker Compose (All Services)

```bash
docker-compose up -d               # Start everything (infra + all services)
docker-compose down                # Stop everything
```

### Build All Services

```bash
npm run build:all
```

---

## 📖 API Documentation (Swagger)

Interactive API documentation is available at:

👉 **http://localhost:3000/api/docs**

The Swagger UI includes:

- All endpoints grouped by tag (Auth, Products, Orders, Users)
- Request/response schemas with examples
- **JWT authentication**: Click the green **Authorize** button, enter `Bearer <your-token>`
- `persistAuthorization` enabled — token survives page reloads

---

## 📡 API Endpoints

### Auth (`/api/v1/auth`)

| Method | Endpoint         | Auth   | Description                             |
| ------ | ---------------- | ------ | --------------------------------------- |
| `POST` | `/auth/register` | Public | Register a new user                     |
| `POST` | `/auth/login`    | Public | Login — returns access + refresh tokens |
| `POST` | `/auth/refresh`  | Public | Refresh expired access token            |

### Products (`/api/v1/products`)

| Method | Endpoint        | Auth   | Description                      |
| ------ | --------------- | ------ | -------------------------------- |
| `GET`  | `/products`     | Public | List all products (Redis cached) |
| `GET`  | `/products/:id` | Public | Get product by ID                |
| `POST` | `/products`     | Admin  | Create a new product             |

### Orders (`/api/v1/orders`)

| Method | Endpoint      | Auth       | Description                                     |
| ------ | ------------- | ---------- | ----------------------------------------------- |
| `POST` | `/orders`     | User/Admin | Create order (validates stock, publishes event) |
| `GET`  | `/orders`     | Admin      | List all orders                                 |
| `GET`  | `/orders/:id` | Admin      | Get order by ID                                 |

### Users (`/api/v1/users`)

| Method   | Endpoint                 | Auth  | Description                         |
| -------- | ------------------------ | ----- | ----------------------------------- |
| `GET`    | `/users?skip=0&limit=20` | Admin | Paginated user list                 |
| `GET`    | `/users/:id`             | Admin | Get user by ID                      |
| `POST`   | `/users`                 | Admin | Create a new user                   |
| `PATCH`  | `/users/:id`             | Admin | Update user (name, roles, isActive) |
| `DELETE` | `/users/:id`             | Admin | Soft-delete user                    |

---

## 🔑 Authentication & Authorization

### How It Works

1. **Register** → Creates user with default role `['user']`
2. **Login** → Returns `accessToken` (15min) + `refreshToken` (7 days)
3. **Access protected routes** → Include `Authorization: Bearer <accessToken>` header
4. **Token expires** → Call `/auth/refresh` with the refresh token to get a new pair
5. **Role-based access** → Use `@Roles('admin')` decorator on controllers

### Token Design

- **Access Token**: Short-lived (15 min), signed with `JWT_ACCESS_SECRET`
- **Refresh Token**: Long-lived (7 days), signed with `JWT_REFRESH_SECRET` (separate secret for defense-in-depth)
- **Refresh Token Rotation**: Each refresh returns a new token pair

### Role Hierarchy

| Role    | Permissions                                |
| ------- | ------------------------------------------ |
| `user`  | Create orders                              |
| `admin` | Create products, list orders, manage users |

### Guard Execution Order

```
JwtAuthGuard (validates Bearer token → populates request.user)
       ↓
RolesGuard (checks request.user.roles against @Roles() metadata)
```

Routes marked with `@Public()` skip both guards entirely.

---

## 👑 Creating an Admin User

New users are registered with `['user']` role by default. To create an admin, promote a user via MongoDB:

### Option 1: Register then Promote (Recommended)

1. **Register a normal user:**

   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@test.com","password":"AdminPass123","name":"Admin"}'
   ```

2. **Promote via mongosh:**

   ```bash
   mongosh "mongodb://root:rootpassword@localhost:27017/order_tracker?authSource=admin" \
     --eval "db.users.updateOne({email:'admin@test.com'}, {\$set:{roles:['user','admin']}})"
   ```

3. **Login as admin:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@test.com","password":"AdminPass123"}'
   ```

### Option 2: Use Swagger UI

1. Open http://localhost:3000/api/docs
2. Call `POST /auth/register` with your admin details
3. Promote via mongosh (see above)
4. Call `POST /auth/login` to get tokens
5. Click **Authorize** and paste `Bearer <token>`
6. Now all admin endpoints are unlocked in the Swagger UI

---

## 🔄 Service Communication

### TCP Microservice Pattern

The API Gateway communicates with backend services via **NestJS TCP transport**:

```typescript
// Gateway sends message pattern and receives response
this.productClient.send('product.findAll', {})
// Product Service handler
@MessagePattern('product.findAll')
async findAll() { ... }
```

Message patterns are defined in `libs/common/src/constants/index.ts`.

### Event-Driven Pattern

Order creation triggers an async event via RabbitMQ:

```
Order Service                      Worker Service
    │                                    │
    ├── 1. Validates stock (TCP)         │
    ├── 2. Reduces stock (TCP)           │
    ├── 3. Saves order (MongoDB)         │
    ├── 4. Publishes event ──RabbitMQ──► ├── Email notification
    │                                    ├── Analytics tracking
    │                                    └── Acknowledges message
```

### Caching Strategy (Cache-Aside)

Product Service uses Redis Cache-Aside pattern:

1. Check Redis → hit: return cached data immediately
2. Miss → query MongoDB → populate Redis → return data
3. On create/update/stock change → invalidate affected cache keys

---

## 📁 Project Structure

```
order-tracker/
├── apps/
│   ├── api-gateway/          # HTTP Gateway + Swagger + Auth Guards
│   │   └── src/
│   │       ├── auth/         # Auth controller, guards, strategies
│   │       ├── orders/       # Order controller (TCP proxy)
│   │       ├── products/     # Product controller (TCP proxy)
│   │       └── users/        # User controller (TCP proxy)
│   ├── auth-service/         # JWT signing, bcrypt, refresh tokens
│   ├── user-service/         # User CRUD, soft-delete, pagination
│   ├── product-service/      # Products, stock, Redis caching
│   ├── order-service/        # Orders, stock validation, RMQ events
│   └── worker-service/       # RabbitMQ consumer, async processing
├── libs/
│   └── common/               # Shared code across all services
│       └── src/
│           ├── constants/    # Message patterns, error codes, cache keys
│           ├── decorators/   # @Public(), @Roles(), @CurrentUser()
│           ├── dto/          # Shared DTOs with validation
│           ├── exceptions/   # DomainException
│           ├── filters/      # HTTP & RPC exception filters
│           ├── guards/       # RolesGuard
│           └── interfaces/   # IUser, IProduct, IOrder, IOrderItem
├── docker-compose.yml        # Infrastructure + all services
├── .env.example              # Environment template
├── package.json              # Monorepo scripts
└── nest-cli.json             # NestJS CLI configuration
```

---

## 📜 NPM Scripts

| Command                             | Description                                           |
| ----------------------------------- | ----------------------------------------------------- |
| `npm run start:all:dev`             | **Start all 6 services concurrently with hot-reload** |
| `npm run start:api-gateway:dev`     | API Gateway (Port 3000)                               |
| `npm run start:auth-service:dev`    | Auth Service (Port 3003)                              |
| `npm run start:user-service:dev`    | User Service (Port 3004)                              |
| `npm run start:product-service:dev` | Product Service (Port 3001)                           |
| `npm run start:order-service:dev`   | Order Service (Port 3002)                             |
| `npm run start:worker-service:dev`  | Worker Service (RMQ Consumer)                         |
| `npm run build:all`                 | Build all services                                    |
| `npm run format`                    | Format code with Prettier                             |
| `npm run lint`                      | Lint & fix with ESLint                                |
| `npm run test`                      | Run unit tests (Jest)                                 |
| `npm run test:cov`                  | Test coverage report                                  |

---

## 🐳 Docker Compose

### Infrastructure Only

```bash
docker-compose up -d mongodb redis rabbitmq
```

### Full Stack (Infra + All Services)

```bash
docker-compose up -d
```

### Service Endpoints

| Service               | Port  | URL                                           |
| --------------------- | ----- | --------------------------------------------- |
| MongoDB               | 27017 | `mongodb://root:rootpassword@localhost:27017` |
| Redis                 | 6379  | `redis://localhost:6379`                      |
| RabbitMQ (AMQP)       | 5672  | `amqp://guest:guest@localhost:5672`           |
| RabbitMQ (Management) | 15672 | http://localhost:15672                        |

---

## 🧪 Testing

### Unit Tests

```bash
npm run test
```

### E2E Tests

```bash
npm run test:e2e
```

### Manual API Testing

Use the Swagger UI at http://localhost:3000/api/docs, or use curl:

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'
```

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### Docker Containers Not Starting

```bash
docker-compose down
docker-compose up -d
```

### Check Docker Logs

```bash
docker-compose logs --tail=100 mongodb
docker-compose logs --tail=100 rabbitmq
```

### MongoDB Connection Issues

Ensure the MongoDB container is healthy:

```bash
docker-compose ps mongodb
```

### RabbitMQ Management UI

If the RabbitMQ management UI is inaccessible, ensure port `15672` is exposed:

```bash
docker-compose port rabbitmq 15672
```

---

## 📄 License

This repository is currently unlicensed.
