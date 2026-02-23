# VersionGate — Setup Guide

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- Docker (running)
- Nginx (installed, writable config at `/etc/nginx/conf.d/`)
- PostgreSQL — local or [Neon](https://neon.tech) (free tier works)
- Git

---

## 1. Clone the repo

```bash
git clone https://github.com/dinexh/VersionGate
cd VersionGate
```

## 2. Install dependencies

```bash
bun install
```

## 3. Configure environment

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

## 4. Push the database schema

```bash
bunx prisma db push
```

> First time only. Re-run after any `schema.prisma` changes.

## 5. Build the dashboard

```bash
cd dashboard
bun install
bun run build
cd ..
```

The static output goes to `dashboard/out/` — Fastify serves it automatically.

## 6. Start the engine

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

## 7. Create your first project

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

## 8. Trigger a deploy

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
