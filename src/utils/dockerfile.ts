import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

/**
 * Ensures a Dockerfile exists in the given build context directory.
 * If one already exists it is left untouched.
 * Otherwise the project type is auto-detected and a Dockerfile is generated.
 *
 * Detection order: buildContextDir first, then repoRootDir (fallback).
 * This handles the common case where the user set a subdirectory as buildContext
 * but package.json lives at the repo root.
 *
 * Returns the directory where the Dockerfile was written (may be repoRootDir
 * if the fallback was used) — callers should use this as the Docker build context.
 *
 * Currently supported runtimes (detected in order):
 *   1. Node.js  — package.json present
 *   2. Python   — requirements.txt present
 *   3. Go       — go.mod present
 *
 * Throws if the project type cannot be detected in either directory.
 */
export async function ensureDockerfile(
  buildContextDir: string,
  appPort: number,
  repoRootDir?: string
): Promise<string> {
  // If a Dockerfile already exists in the build context, use it as-is.
  const dockerfilePath = path.join(buildContextDir, "Dockerfile");
  try {
    await fs.access(dockerfilePath);
    logger.info({ buildContextDir }, "Dockerfile found — skipping generation");
    return buildContextDir;
  } catch {
    // Does not exist — generate one
  }

  // Try detection in the specified build context first.
  const dirsToTry: string[] = [buildContextDir];
  if (repoRootDir && repoRootDir !== buildContextDir) {
    dirsToTry.push(repoRootDir);
  }

  for (const dir of dirsToTry) {
    const content = await tryGenerateDockerfile(dir, appPort);
    if (content !== null) {
      const targetDockerfile = path.join(dir, "Dockerfile");
      await fs.writeFile(targetDockerfile, content, "utf-8");
      if (dir !== buildContextDir) {
        logger.info(
          { buildContextDir, fallbackDir: dir, appPort },
          "Dockerfile auto-generated using repo root (build context adjusted)"
        );
      } else {
        logger.info({ dir, appPort }, "Dockerfile auto-generated");
      }
      return dir;
    }
  }

  throw new Error(
    "Could not detect project type. Add a Dockerfile to your repository and redeploy."
  );
}

// ── Detector ─────────────────────────────────────────────────────────────────

/** Returns generated Dockerfile content, or null if the project type is undetectable. */
async function tryGenerateDockerfile(repoDir: string, appPort: number): Promise<string | null> {
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

  return null;
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
