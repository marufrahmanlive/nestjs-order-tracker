# Order Tracker

Order Tracker is a NestJS microservice-based application for managing products, orders, and background worker processing. This repository includes:

- `api-gateway` — HTTP gateway for orders and products
- `product-service` — product catalog, stock reduction, Redis caching
- `order-service` — order validation, MongoDB persistence, RabbitMQ publishing
- `worker-service` — RabbitMQ consumer for `order.created` events

Infrastructure services used by this project:

- MongoDB
- Redis
- RabbitMQ

---

## Requirements

- Node.js 20+ (recommended)
- npm 10+ or compatible
- Docker & Docker Compose
- Git

---

## Install dependencies

```bash
cd d:/projects(2026)/order-tracker
npm install
```

> Run `npm install` from the repository root to install all shared dependencies.

---

## Docker infrastructure

Start the required infrastructure services:

```bash
docker compose up -d mongodb redis rabbitmq
```

Verify the containers:

```bash
docker compose ps
```

Stop infrastructure:

```bash
docker compose down
```

### Docker service endpoints

- MongoDB: `mongodb://localhost:27017`
- Redis: `redis://localhost:6379`
- RabbitMQ: `amqp://guest:guest@localhost:5672`
- RabbitMQ management UI: `http://localhost:15672`

---

## Environment variables

The services read these values from `process.env`.

Default values are set in code, so the app works with local Docker defaults.

```env
MONGODB_URI=mongodb://localhost:27017/order_tracker
REDIS_HOST=localhost
REDIS_PORT=6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
NODE_ENV=development
```

You can place these values in a `.env` file if you want to use environment variable loading in your shell.

---

## Run services

### Run all services in development mode

Open a separate terminal for each service:

```bash
npm run start:api-gateway:dev
npm run start:product-service:dev
npm run start:order-service:dev
npm run start:worker-service:dev
```

### Run a specific service

```bash
npm run start:api-gateway
npm run start:product-service
npm run start:order-service
npm run start:worker-service
```

### Build all services

```bash
npm run build:all
```

### Production-like start

```bash
npm run start:prod
```

---

## Package scripts

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm run build` | Build the default Nest application |
| `npm run build:all` | Build all apps (`api-gateway`, `product-service`, `order-service`, `worker-service`) |
| `npm run start` | Start the default Nest app |
| `npm run start:dev` | Start the default Nest app in watch mode |
| `npm run start:debug` | Start the default Nest app in debug watch mode |
| `npm run start:api-gateway` | Start the API Gateway service |
| `npm run start:api-gateway:dev` | Start the API Gateway service in watch mode |
| `npm run start:product-service` | Start the Product Service |
| `npm run start:product-service:dev` | Start the Product Service in watch mode |
| `npm run start:order-service` | Start the Order Service |
| `npm run start:order-service:dev` | Start the Order Service in watch mode |
| `npm run start:worker-service` | Start the Worker Service |
| `npm run start:worker-service:dev` | Start the Worker Service in watch mode |
| `npm run format` | Format source files |
| `npm run lint` | Lint and fix TypeScript files |
| `npm run test` | Run Jest unit tests |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run test:cov` | Generate test coverage |
| `npm run test:e2e` | Run end-to-end tests |

---

## API Gateway endpoints

The API gateway exposes the following HTTP routes:

### Products
- `POST /products` — create a product
- `GET /products` — list all products
- `GET /products/:id` — get a product by ID

### Orders
- `POST /orders` — create an order
- `GET /orders` — list all orders
- `GET /orders/:id` — get an order by ID

---

## Service behavior

- `product-service` uses Redis for caching product data and fulfills stock reduction requests.
- `order-service` validates product availability via the product service, saves orders to MongoDB, and publishes `order.created` events to RabbitMQ.
- `worker-service` listens for RabbitMQ `order.created` events and processes those orders.

---

## Troubleshooting

### Port conflict on `3001`

If port `3001` is already in use:

```powershell
netstat -ano | findstr :3001
taskkill /PID <pid> /F
```

### Check Docker logs

```bash
docker compose logs --tail=100
```

### Verify infrastructure

```bash
docker compose ps
```

---

## Notes

- This project is configured for local development and microservice testing.
- If you want to run only the API Gateway, the required infrastructure services are MongoDB, Redis, and RabbitMQ.

---

## License

This repository is currently unlicensed.
