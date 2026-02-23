# VersionGate Engine — Architecture Diagram

## Deployment Pipeline

```
  CLIENT
    │
    │  POST /api/v1/deploy { projectId }
    ▼
┌─────────────┐
│   Fastify   │  ──routes──►  Controller  ──►  DeploymentService
│   Router    │
└─────────────┘
                                                      │
                              ┌───────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Acquire Lock    │  ── already locked? ──► 409 Conflict
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Git clone/pull  │  (GitService → execFileAsync)
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Pick Color      │  ACTIVE=BLUE? → use GREEN
                    │  & Port          │  ACTIVE=GREEN? → use BLUE
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  DB: DEPLOYING   │  ◄── crash safety marker
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  docker build    │  imageTag = versiongate-<name>:<ts>
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  docker run      │  containerName = <name>-blue/green
                    └────────┬─────────┘  port = basePort or basePort+1
                             │
                    ┌────────▼─────────┐
                    │  Health Check    │  GET http://localhost:<port>/health
                    │  (with retries)  │  checks latency threshold too
                    └────────┬─────────┘
                             │
               ┌─────────────┴─────────────┐
             PASS                         FAIL
               │                            │
               ▼                            ▼
    ┌──────────────────┐        ┌──────────────────────┐
    │  Nginx upstream  │        │  docker stop + rm    │
    │  rewrite + reload│        │  DB: FAILED          │
    └────────┬─────────┘        │  Release lock        │
             │                  │  throw error ──► 500 │
             ▼                  └──────────────────────┘
    ┌──────────────────┐
    │  DB: new=ACTIVE  │
    │  DB: old=ROLLED_ │
    │       BACK       │
    └────────┬─────────┘
             │
    ┌────────▼─────────┐
    │  docker stop+rm  │  old container torn down
    │  (old container) │
    └────────┬─────────┘
             │
    ┌────────▼─────────┐
    │  Release Lock    │  (always via finally)
    └──────────────────┘
```

---

## Blue-Green Slot State

```
  Before deploy:          During deploy:          After deploy:

  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
  │  BLUE  :3100 │◄─Nginx │  BLUE  :3100 │◄─Nginx │  BLUE  :3100 │  stopped
  │   ACTIVE     │        │   ACTIVE     │        │  ROLLED_BACK │
  └──────────────┘        └──────────────┘        └──────────────┘
  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
  │  GREEN :3101 │        │  GREEN :3101 │        │  GREEN :3101 │◄─Nginx
  │   (empty)    │        │  DEPLOYING   │        │   ACTIVE     │
  └──────────────┘        └──────────────┘        └──────────────┘
```

---

## Startup Reconciliation (Crash Recovery)

```
  Server starts
       │
       ▼
  Find all DEPLOYING  ──► stop+rm containers ──► mark FAILED
       │
       ▼
  Find all ACTIVE     ──► docker inspect each
       │                        │
       │               not running? ──► mark FAILED
       │
       ▼
  Begin accepting requests
```

---

## Rollback Flow

```
  POST /api/v1/projects/:id/rollback

  Find ACTIVE (current v3) ──► Find last ROLLED_BACK (prev v2)
                                        │
                               docker run (prev image+port)
                                        │
                               Health check prev container
                               FAIL ──► abort, current stays live
                                        │
                                       PASS
                                        │
                               Nginx ──► prev port
                               docker stop+rm current
                               DB: current=ROLLED_BACK, prev=ACTIVE
```

---

## Component Overview

```
  HTTP Request
      │
  Fastify router ──► Controller ──► Service layer
                                         │
                               ┌─────────┴─────────┐
                          Prisma/DB            Docker CLI
                          (state)        (build/run/stop/remove)
                               │
                            Nginx
                       (traffic switch)
```

---

## Deployment Status Lifecycle

```
  (new record)
      │
   PENDING  (reserved, not yet used in pipeline)
      │
  DEPLOYING  ◄── crash here? reconciliation marks FAILED on next startup
      │
   ┌──┴──┐
  FAIL  ACTIVE  ◄──────────────────────────────┐
                │                               │
                │  next deploy succeeds         │  rollback succeeds
                ▼                               │
          ROLLED_BACK  ────────────────────────►┘
```
