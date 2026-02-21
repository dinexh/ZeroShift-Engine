import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

/**
 * Ensures a Dockerfile exists in the given repo directory.
 * If one already exists it is left untouched.
 * Otherwise the project type is auto-detected and a Dockerfile is generated.
 *
 * Currently supported runtimes (detected in order):
 *   1. Node.js  — package.json present
 *   2. Python   — requirements.txt present
 *   3. Go       — go.mod present
 *
 * Throws if the project type cannot be detected.
 */
export async function ensureDockerfile(repoDir: string, appPort: number): Promise<void> {
  const dockerfilePath = path.join(repoDir, "Dockerfile");

  try {
    await fs.access(dockerfilePath);
    logger.info({ repoDir }, "Dockerfile found — skipping generation");
    return;
  } catch {
    // Does not exist — generate one
  }

  const content = await generateDockerfile(repoDir, appPort);
  await fs.writeFile(dockerfilePath, content, "utf-8");
  logger.info({ repoDir, appPort }, "Dockerfile auto-generated");
}

// ── Detector ─────────────────────────────────────────────────────────────────

async function generateDockerfile(repoDir: string, appPort: number): Promise<string> {
  // 1. Node.js
  const pkgJsonPath = path.join(repoDir, "package.json");
  try {
    const raw = await fs.readFile(pkgJsonPath, "utf-8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    return await buildNodeDockerfile(repoDir, pkg, appPort);
  } catch {
    // not Node
  }

  // 2. Python
  try {
    await fs.access(path.join(repoDir, "requirements.txt"));
    return buildPythonDockerfile(appPort);
  } catch {
    // not Python
  }

  // 3. Go
  try {
    await fs.access(path.join(repoDir, "go.mod"));
    return buildGoDockerfile(appPort);
  } catch {
    // not Go
  }

  throw new Error(
    "Could not detect project type. Add a Dockerfile to your repository and redeploy."
  );
}

// ── Node.js ───────────────────────────────────────────────────────────────────

async function buildNodeDockerfile(
  repoDir: string,
  pkg: Record<string, unknown>,
  appPort: number
): Promise<string> {
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const hasBuild = Boolean(scripts.build);

  // Detect package manager from lock file
  const hasBunLock  = await fileExists(repoDir, "bun.lockb");
  const hasYarnLock = await fileExists(repoDir, "yarn.lock");
  const hasPnpmLock = await fileExists(repoDir, "pnpm-lock.yaml");

  if (hasBunLock) {
    return buildBunDockerfile(appPort, hasBuild);
  }
  if (hasYarnLock) {
    return buildYarnDockerfile(appPort, hasBuild);
  }
  if (hasPnpmLock) {
    return buildPnpmDockerfile(appPort, hasBuild);
  }
  return buildNpmDockerfile(appPort, hasBuild);
}

function buildNpmDockerfile(appPort: number, hasBuild: boolean): string {
  return lines([
    "FROM node:20-alpine",
    "",
    "WORKDIR /app",
    "",
    "COPY package*.json ./",
    "RUN npm install",
    "",
    "COPY . .",
    "",
    ...(hasBuild ? ["RUN npm run build", ""] : []),
    `EXPOSE ${appPort}`,
    "",
    'CMD ["npm", "start"]',
  ]);
}

function buildYarnDockerfile(appPort: number, hasBuild: boolean): string {
  return lines([
    "FROM node:20-alpine",
    "",
    "WORKDIR /app",
    "",
    "COPY package.json yarn.lock ./",
    "RUN yarn install --frozen-lockfile",
    "",
    "COPY . .",
    "",
    ...(hasBuild ? ["RUN yarn build", ""] : []),
    `EXPOSE ${appPort}`,
    "",
    'CMD ["yarn", "start"]',
  ]);
}

function buildPnpmDockerfile(appPort: number, hasBuild: boolean): string {
  return lines([
    "FROM node:20-alpine",
    "",
    "RUN npm install -g pnpm",
    "",
    "WORKDIR /app",
    "",
    "COPY package.json pnpm-lock.yaml ./",
    "RUN pnpm install --frozen-lockfile",
    "",
    "COPY . .",
    "",
    ...(hasBuild ? ["RUN pnpm run build", ""] : []),
    `EXPOSE ${appPort}`,
    "",
    'CMD ["pnpm", "start"]',
  ]);
}

function buildBunDockerfile(appPort: number, hasBuild: boolean): string {
  return lines([
    "FROM oven/bun:alpine",
    "",
    "WORKDIR /app",
    "",
    "COPY package.json bun.lockb ./",
    "RUN bun install --frozen-lockfile",
    "",
    "COPY . .",
    "",
    ...(hasBuild ? ["RUN bun run build", ""] : []),
    `EXPOSE ${appPort}`,
    "",
    'CMD ["bun", "run", "start"]',
  ]);
}

// ── Python ────────────────────────────────────────────────────────────────────

function buildPythonDockerfile(appPort: number): string {
  return lines([
    "FROM python:3.11-slim",
    "",
    "WORKDIR /app",
    "",
    "COPY requirements.txt .",
    "RUN pip install --no-cache-dir -r requirements.txt",
    "",
    "COPY . .",
    "",
    `EXPOSE ${appPort}`,
    "",
    'CMD ["python", "app.py"]',
  ]);
}

// ── Go ────────────────────────────────────────────────────────────────────────

function buildGoDockerfile(appPort: number): string {
  return lines([
    "FROM golang:1.22-alpine AS builder",
    "WORKDIR /app",
    "COPY go.mod go.sum ./",
    "RUN go mod download",
    "COPY . .",
    "RUN go build -o server .",
    "",
    "FROM alpine:latest",
    "WORKDIR /app",
    "COPY --from=builder /app/server .",
    `EXPOSE ${appPort}`,
    'CMD ["./server"]',
  ]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lines(arr: string[]): string {
  return arr.join("\n") + "\n";
}

async function fileExists(dir: string, filename: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, filename));
    return true;
  } catch {
    return false;
  }
}
