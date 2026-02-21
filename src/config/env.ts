import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`[ZeroShift] FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optionalEnv("PORT", "9090"), 10) || 9090,
  logLevel: optionalEnv("LOG_LEVEL", "info"),
  databaseUrl: requireEnv("DATABASE_URL"),
  dockerNetwork: optionalEnv("DOCKER_NETWORK", "zeroshift-net"),
  nginxConfigPath: optionalEnv("NGINX_CONFIG_PATH", "/etc/nginx/conf.d/upstream.conf"),
  projectsRootPath: optionalEnv("PROJECTS_ROOT_PATH", "/var/zeroshift/projects"),
  validation: {
    healthTimeoutMs: 5000,
    retryDelayMs: 2000,
    maxLatencyMs: 2000,
    maxRetries: 15, // 30 seconds total — accommodates slow-booting apps
  },
} as const;
