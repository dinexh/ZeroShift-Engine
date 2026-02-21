# ZeroShift Engine

Lightweight zero-downtime Docker deployment orchestrator.

## Architecture

```
src/
├── app.ts                        # Fastify instance + plugin registration
├── server.ts                     # Entry point, graceful shutdown
├── config/
│   └── env.ts                    # Typed environment config
├── controllers/
│   └── deployment.controller.ts  # Request handlers
├── routes/
│   └── deployment.routes.ts      # Route + schema definitions
├── services/
│   ├── deployment.service.ts     # Core deploy orchestration
│   ├── validation.service.ts     # Container health checks
│   ├── traffic.service.ts        # Nginx upstream management
│   └── rollback.service.ts       # Rollback orchestration
├── repositories/
│   └── deployment.repository.ts  # Prisma data access layer
├── prisma/
│   └── client.ts                 # Singleton Prisma client
└── utils/
    ├── docker.ts                 # Docker CLI wrappers
    ├── exec.ts                   # Promisified child_process.exec
    ├── errors.ts                 # Typed error classes
    └── logger.ts                 # Pino logger instance
prisma/
└── schema.prisma                 # Deployment model + enums
```

## Deployment Flow

```
POST /api/v1/deploy
  → Pull image
  → Start green container
  → Health check (retries × 5)
    ├─ Pass → Switch Nginx → Mark ACTIVE
    └─ Fail → Stop container → Mark FAILED

POST /api/v1/rollback
  → Stop current container → Mark ROLLED_BACK
  → Restore Nginx → Mark previous ACTIVE
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/deploy` | Trigger a deployment |
| `POST` | `/api/v1/rollback` | Rollback to previous version |
| `GET` | `/api/v1/deployments` | List all deployments |
| `GET` | `/api/v1/status` | Current active deployment |
| `GET` | `/health` | Health check |

### POST /api/v1/deploy
```json
{ "imageTag": "my-app:v1.2.3" }
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `DOCKER_NETWORK` | `zeroshift-net` | Docker network name |
| `BASE_APP_PORT` | `3100` | Base port for containers |
| `NGINX_CONFIG_PATH` | `/etc/nginx/conf.d/upstream.conf` | Nginx upstream config |
| `PORT` | `3000` | API server port |
| `NODE_ENV` | `development` | Environment |
| `LOG_LEVEL` | `info` | Pino log level |

## Quick Start

```bash
cp .env.example .env
# edit .env

npm install
npx prisma migrate dev --name init
npm run dev
```

> **Note:** `pino-pretty` is required for dev logging. It is included in dependencies as of v1.0.1.

## Docker

```bash
docker compose up -d
```
