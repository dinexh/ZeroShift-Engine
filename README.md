# VersionGate

Self-hosted zero-downtime deployment engine. Push to GitHub → VersionGate pulls the source, builds a Docker image, spins up the new container, switches Nginx traffic, and tears down the old one — all without a single second of downtime.

Built for single-server (KVM/VPS) setups where you want Vercel-style deployments on your own hardware.

---

## What It Does

- **Blue-green deployments** — every project gets two container slots (blue/green). Deploys always target the idle slot; live traffic is never touched until the new container is confirmed healthy.
- **Webhook auto-deploy** — add your project's webhook URL to GitHub and every push to the configured branch triggers a deploy automatically.
- **One-click rollback** — restore the previous deployment instantly via the dashboard or API.
- **Crash recovery** — on restart, stale `DEPLOYING` records are marked `FAILED` and orphaned containers are cleaned up automatically.
- **AI CI pipeline generation** — generate a GitHub Actions workflow for any project with a single API call (requires Gemini API key).

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.x + TypeScript |
| API server | Fastify |
| Database | PostgreSQL via Prisma (Neon serverless supported) |
| Containers | Docker CLI |
| Proxy | Nginx upstream config management |
| Process manager | PM2 |
| Dashboard | Next.js (static export, served by Fastify) |

---

## Quick Start

```bash
git clone https://github.com/dinexh/VersionGate
cd VersionGate
sudo bash setup.sh
```

The script asks for your domain/IP and database URL, then wires up Nginx, builds the dashboard, pushes the schema, and starts the engine via PM2. Optional HTTPS via certbot if a domain is detected.

---

## Docs

- [Architecture](docs/ARCHITECTURE.md) — deployment pipeline, blue-green state diagrams, rollback flow, crash recovery
- [Setup & API](docs/SETUP.md) — setup script, manual setup, environment variables, full API reference
