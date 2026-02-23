# VersionGate Engine

Self-hosted zero-downtime deployment engine. Push to GitHub → VersionGate pulls the source, builds a Docker image, spins up the new container, switches Nginx traffic, and tears down the old one — all without a single second of downtime.

Built for single-server (KVM/VPS) setups where you want Vercel-style deployments on your own hardware.

---

## How It Works

### The Approach

VersionGate uses a **blue-green deployment** strategy. Every project gets two container slots — `blue` and `green` — running on adjacent ports. At any moment one slot is live (receiving traffic) and the other is idle. Each deploy targets the idle slot, so the live app is never touched until the new one is confirmed healthy.

```
Your Repo
    │
    │  git push  (or manual trigger)
    ▼
VersionGate Engine
    │
    ├── 1. Pull source         git fetch + reset to branch HEAD
    ├── 2. Build image         docker build -t versiongate-<name>:<ts> .
    ├── 3. Pick idle slot      BLUE (basePort) or GREEN (basePort+1)
    ├── 4. Start container     docker run -d -p <hostPort>:<appPort>
    ├── 5. Switch traffic      rewrite nginx upstream → new port → nginx -s reload
    ├── 6. Activate            mark new deployment ACTIVE
    └── 7. Retire old          stop + remove previous container → mark ROLLED_BACK

          ┌───────────────────────────────┐
Nginx ──► │  upstream  localhost:310X     │
          └───────────────────────────────┘
              BLUE :3100     GREEN :3101
              [ LIVE ]       [ idle ]
                   ↕  switches on every deploy
```

### Deployment States

```
PENDING → DEPLOYING → ACTIVE
                    ↘ FAILED        (build error, container crash, cancelled)
ACTIVE  → ROLLED_BACK               (after the next successful deploy)
```

`DEPLOYING` is the crash-safe checkpoint. If the engine restarts mid-deploy, startup reconciliation immediately marks stale `DEPLOYING` records `FAILED` and cleans up orphaned containers.

### Auto-Deploy via Webhook

Every project gets a unique webhook URL. Add it to your GitHub repo under **Settings → Webhooks** and VersionGate will auto-deploy on every push to the configured branch.

```
POST /api/v1/webhooks/<secret>
  → validate secret → check branch match → fire deploy async → 200 OK
```

### Rollback

One click (or one API call) restores the previous deployment:

```
POST /api/v1/projects/:id/rollback
  → find most-recent ROLLED_BACK deployment
  → re-run that container on its original port
  → health-check passes → switch nginx → swap statuses
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.x + TypeScript |
| API server | Fastify |
| Database | PostgreSQL via Prisma (Neon serverless supported) |
| Containers | Docker CLI (`execFileAsync` — no shell injection) |
| Proxy | Nginx upstream config management |
| Process manager | PM2 |
| Logging | Pino |
| Dashboard | Next.js (static export, served by Fastify) |

---

## Project Structure

```
versiongate-engine/
├── src/
│   ├── server.ts                       Entry point + graceful shutdown + startup reconciliation
│   ├── app.ts                          Fastify builder, error handler, static serving, SPA fallback
│   ├── config/env.ts                   All env vars — typed, throws on missing required
│   ├── controllers/
│   │   ├── deployment.controller.ts    deploy, list, status, cancelDeploy
│   │   ├── project.controller.ts       CRUD, rollback, env update, generate-pipeline
│   │   ├── webhook.controller.ts       GitHub push webhook handler
│   │   └── system.controller.ts        server stats, reconcile
│   ├── routes/                         Fastify route registration (schema + handler)
│   ├── services/
│   │   ├── deployment.service.ts       Blue-green orchestration pipeline + cancel
│   │   ├── git.service.ts              clone / fetch / reset source
│   │   ├── traffic.service.ts          nginx upstream rewrite + reload
│   │   ├── rollback.service.ts         project-scoped rollback
│   │   └── reconciliation.service.ts   crash recovery + container audit
│   ├── repositories/                   Prisma data access layer
│   └── utils/
│       ├── docker.ts                   buildImage, runContainer, stopContainer, freeHostPort
│       ├── dockerfile.ts               auto-generate Dockerfile (runtime detection)
│       ├── exec.ts                     execFileAsync with stdout/stderr capture
│       └── errors.ts                   AppError, NotFoundError, ConflictError, DeploymentError
├── prisma/schema.prisma                Project + Deployment models
├── dashboard/                          Next.js dashboard (static export)
└── ecosystem.config.cjs                PM2 config
```

---

## Local Setup

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- Docker (running)
- Nginx (installed, writable config at `/etc/nginx/conf.d/`)
- PostgreSQL — local or [Neon](https://neon.tech) (free tier works)
- Git

---

### 1. Clone the repo

```bash
git clone https://github.com/dinexh/VersionGate
cd VersionGate
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment

Create a `.env` file at the repo root:

```env
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/versiongate
# Or Neon:
# DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require&channel_binding=require

# Optional — defaults shown
PORT=9090
LOG_LEVEL=info
DOCKER_NETWORK=bridge
NGINX_CONFIG_PATH=/etc/nginx/conf.d/upstream.conf
PROJECTS_ROOT_PATH=/var/versiongate/projects
GEMINI_API_KEY=             # for AI CI pipeline generation (optional)
```

### 4. Push the database schema

```bash
bunx prisma db push
```

> First time only. Re-run after any `schema.prisma` changes.

### 5. Build the dashboard

```bash
cd dashboard
bun install
bun run build
cd ..
```

The static output goes to `dashboard/out/` — Fastify serves it automatically.

### 6. Start the engine

**Development (watch mode):**
```bash
bun --watch src/server.ts
```

**Production (PM2):**
```bash
pm2 start ecosystem.config.cjs
pm2 save
```

The engine starts at `http://localhost:9090`.
Open the dashboard at `http://localhost:9090`.

---

### 7. Create your first project

```bash
curl -X POST http://localhost:9090/api/v1/projects \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "myapp",
    "repoUrl": "https://github.com/you/myapp",
    "branch": "main",
    "buildContext": ".",
    "appPort": 3000,
    "healthPath": "/health"
  }'
```

> `basePort` is auto-assigned (starts at 3100, increments by 2 per project).
> `webhookSecret` is auto-generated — copy the webhook URL from the dashboard.

### 8. Trigger a deploy

```bash
curl -X POST http://localhost:9090/api/v1/deploy \
  -H 'Content-Type: application/json' \
  -d '{ "projectId": "<id from step 7>" }'
```

Or just click **Deploy** in the dashboard.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `PORT` | No | `9090` | API + dashboard server port |
| `DOCKER_NETWORK` | No | `bridge` | Docker network for containers |
| `NGINX_CONFIG_PATH` | No | `/etc/nginx/conf.d/upstream.conf` | Nginx upstream file path |
| `PROJECTS_ROOT_PATH` | No | `/var/versiongate/projects` | Root dir for cloned repos |
| `MONIX_PATH` | No | `/opt/monix` | Path to Monix binary (server stats) |
| `MONIX_PORT` | No | `3030` | Monix metrics port |
| `GEMINI_API_KEY` | No | — | Google AI Studio key for CI pipeline generation |
| `GEMINI_MODEL` | No | `gemini-2.5-pro` | Gemini model ID |
| `LOG_LEVEL` | No | `info` | Pino log level (`trace` `debug` `info` `warn` `error`) |

---

## API Reference

### Projects

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/projects` | Create project |
| `GET` | `/api/v1/projects` | List all projects |
| `GET` | `/api/v1/projects/:id` | Get project |
| `PATCH` | `/api/v1/projects/:id` | Update branch / port / buildContext |
| `PATCH` | `/api/v1/projects/:id/env` | Update env vars |
| `DELETE` | `/api/v1/projects/:id` | Delete project |
| `POST` | `/api/v1/projects/:id/rollback` | Rollback to previous deployment |
| `POST` | `/api/v1/projects/:id/cancel-deploy` | Cancel in-progress deployment |
| `POST` | `/api/v1/projects/:id/generate-pipeline` | AI-generate GitHub Actions CI YAML |

### Deployments

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/deploy` | Trigger deployment `{ projectId }` |
| `GET` | `/api/v1/deployments` | List all deployments |
| `GET` | `/api/v1/status` | Current active deployment |

### Webhooks & System

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/webhooks/:secret` | GitHub push webhook (auto-deploy) |
| `GET` | `/api/v1/system/server-stats` | Host CPU / memory / disk / network |
| `GET` | `/api/v1/system/server-dashboard` | Full server dashboard data |
| `POST` | `/api/v1/system/reconcile` | Manual crash recovery trigger |
| `GET` | `/health` | Engine health check |
