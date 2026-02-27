# AGENTS.md

## Cursor Cloud specific instructions

### Overview

VersionGate is a self-hosted zero-downtime Docker deployment engine (Bun + Fastify + Prisma + Next.js dashboard). See `README.md` and `docs/SETUP.md` for full details.

### Services

| Service | How to start | Port |
|---------|-------------|------|
| PostgreSQL | `sudo docker compose up db -d` | 5432 |
| VersionGate Engine (dev) | `DATABASE_URL="postgresql://postgres:password@localhost:5432/versiongate" bun --watch src/server.ts` | 9090 |
| Nginx | `sudo nginx` (already installed) | 80 |
| Docker daemon | `sudo dockerd` (must be running for deployments) | — |

### Dev workflow

Standard commands are in `package.json` (root + `dashboard/`). Key scripts:

- **Backend dev server**: `bun run dev` (requires `DATABASE_URL` env var)
- **Backend typecheck**: `bun run typecheck`
- **Dashboard build** (static export): `cd dashboard && bun run build`
- **Dashboard lint**: `cd dashboard && bun run lint`
- **Prisma generate**: `bunx prisma generate`
- **Prisma migrate**: `DATABASE_URL="..." bunx prisma migrate deploy`

### Non-obvious gotchas

- **DATABASE_URL must be set** before starting the engine. Without it, the engine runs in "setup mode" (redirects everything to `/setup`). For local dev: `DATABASE_URL="postgresql://postgres:password@localhost:5432/versiongate"`
- **Dashboard is a static export** (`output: "export"` in `dashboard/next.config.ts`). The built files go to `dashboard/out/` and are served by the Fastify backend. You must run `cd dashboard && bun run build` before starting the engine if you want the dashboard UI.
- **Prisma migrations vs db push**: `prisma migrate dev` is interactive and fails in non-interactive terminals. Use `bunx prisma migrate deploy` to apply existing migrations, or `bunx prisma db push` to sync schema directly.
- **Backend ESLint not configured**: The root `package.json` has a `lint` script (`eslint src --ext .ts`) but `eslint` is not in `devDependencies` and no `.eslintrc` exists. Use `bun run typecheck` for backend code validation instead.
- **Docker-in-Docker**: In the Cloud VM, Docker requires `fuse-overlayfs` storage driver and `iptables-legacy`. The daemon config is at `/etc/docker/daemon.json`.
- **Port 9090**: The engine defaults to port 9090 (not 3000 as in `.env.example`). The `config/env.ts` falls back to 9090 when `PORT` is not set or invalid.
