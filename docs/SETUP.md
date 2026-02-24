# VersionGate — Setup Guide

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- Docker (running)
- Nginx (installed)
- PostgreSQL — local, bundled via docker-compose, or [Neon](https://neon.tech) (free tier works)
- PM2 (`npm i -g pm2`) — optional, falls back to nohup
- Git

---

## One-command setup

Clone the repo and run the setup script — it handles everything including Nginx, the dashboard build, DB schema push, and PM2:

```bash
git clone https://github.com/dinexh/VersionGate
cd VersionGate
sudo bash setup.sh
```

The script will ask you for:
1. **Domain or IP** — e.g. `versiongate.example.com` or `1.2.3.4`
2. **PostgreSQL connection string** — leave blank to use the bundled docker-compose Postgres
3. **Gemini API key** — optional, for AI CI pipeline generation
4. **HTTPS** — if a real domain is detected, certbot is offered automatically

After it completes, the dashboard is live at `http(s)://your-domain-or-ip`.

---

## What the script does

| Step | Action |
|------|--------|
| 1 | Writes `.env` from your input |
| 2 | Optionally starts bundled Postgres via docker-compose |
| 3 | `bun install` + `bunx prisma db push` |
| 4 | Builds Next.js dashboard (`dashboard/out/`) |
| 5 | Creates `/var/versiongate/projects` |
| 6 | Writes Nginx reverse-proxy config → reloads Nginx |
| 7 | Optionally runs `certbot` for HTTPS |
| 8 | Starts the engine via PM2 (or nohup as fallback) |

---

## Manual setup (alternative)

If you prefer to set things up yourself:

### 1. Clone & install

```bash
git clone https://github.com/dinexh/VersionGate
cd VersionGate
bun install
```

### 2. Configure environment

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
NGINX_CONFIG_PATH=/etc/nginx/conf.d/vg-upstreams.conf
PROJECTS_ROOT_PATH=/var/versiongate/projects
GEMINI_API_KEY=             # for AI CI pipeline generation (optional)
```

### 3. Push the database schema

```bash
bunx prisma db push
```

### 4. Build the dashboard

```bash
cd dashboard && bun install && bun run build && cd ..
```

### 5. Nginx reverse proxy

Create `/etc/nginx/sites-available/versiongate`:

```nginx
server {
    listen 80;
    server_name your-domain-or-ip;

    location / {
        proxy_pass         http://127.0.0.1:9090;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/versiongate /etc/nginx/sites-enabled/
nginx -t && nginx -s reload
```

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
