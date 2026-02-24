import { writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { logger } from "../utils/logger";

export interface SetupPayload {
  domain: string;
  databaseUrl: string;
  geminiApiKey?: string;
}

export interface SetupStep {
  step: string;
  ok: boolean;
  error?: string;
}

const ENV_PATH = join(process.cwd(), ".env");
const NGINX_CONF_PATH = "/etc/nginx/conf.d/versiongate.conf";

export function isSetupComplete(): boolean {
  return existsSync(ENV_PATH) && !!process.env.DATABASE_URL;
}

export async function applySetup(payload: SetupPayload): Promise<SetupStep[]> {
  const steps: SetupStep[] = [];

  // 1 — Write .env
  try {
    const lines = [
      `DATABASE_URL="${payload.databaseUrl}"`,
      `PORT=9090`,
      payload.geminiApiKey ? `GEMINI_API_KEY="${payload.geminiApiKey}"` : "",
    ]
      .filter(Boolean)
      .join("\n");

    writeFileSync(ENV_PATH, lines + "\n", { mode: 0o600 });
    // Reload into current process
    process.env.DATABASE_URL = payload.databaseUrl;
    if (payload.geminiApiKey) process.env.GEMINI_API_KEY = payload.geminiApiKey;
    steps.push({ step: "Write .env", ok: true });
  } catch (err: any) {
    steps.push({ step: "Write .env", ok: false, error: err.message });
    return steps; // can't continue
  }

  // 2 — Run prisma db push
  try {
    execSync("bunx prisma db push --accept-data-loss", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: payload.databaseUrl },
      stdio: "pipe",
      timeout: 60_000,
    });
    steps.push({ step: "Database migrate", ok: true });
  } catch (err: any) {
    steps.push({ step: "Database migrate", ok: false, error: err.stderr?.toString() ?? err.message });
    return steps;
  }

  // 3 — Write Nginx vhost (best-effort — may not have Nginx installed)
  try {
    const nginxBlock = `server {
    listen 80;
    server_name ${payload.domain};

    location / {
        proxy_pass http://127.0.0.1:9090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
    writeFileSync(NGINX_CONF_PATH, nginxBlock);
    execSync("nginx -t && nginx -s reload", { stdio: "pipe", timeout: 10_000 });
    steps.push({ step: "Configure Nginx", ok: true });
  } catch (err: any) {
    // Non-fatal — VPS may not have Nginx yet
    logger.warn({ err: err.message }, "Nginx config skipped (not fatal)");
    steps.push({ step: "Configure Nginx", ok: false, error: "Nginx not available — configure manually" });
  }

  return steps;
}
