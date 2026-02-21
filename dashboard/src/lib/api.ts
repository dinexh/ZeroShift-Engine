export type DeploymentStatus =
  | "PENDING"
  | "DEPLOYING"
  | "ACTIVE"
  | "FAILED"
  | "ROLLED_BACK";

export type DeploymentColor = "BLUE" | "GREEN";

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  buildContext: string;
  localPath: string;
  appPort: number;
  healthPath: string;
  basePort: number;
  env: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Deployment {
  id: string;
  version: number;
  imageTag: string;
  containerName: string;
  port: number;
  color: DeploymentColor;
  status: DeploymentStatus;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerMetrics {
  running: boolean;
  cpu: number;
  memoryUsed: number;
  memoryLimit: number;
  memoryPercent: number;
  timestamp: string;
}

export interface LogsResponse {
  lines: string[];
  containerName: string | null;
}

export interface DeployResult {
  deployment: Deployment;
  message: string;
}

export interface RollbackResult {
  rolledBackFrom: Deployment;
  restoredTo: Deployment;
  message: string;
}

// When served from the same Fastify server, all API calls are same-origin.
// Set NEXT_PUBLIC_API_BASE only if running the dashboard dev server separately.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { message?: string }).message ?? `HTTP ${res.status}`
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface CreateProjectInput {
  name: string;
  repoUrl: string;
  branch: string;
  buildContext: string;
  appPort: number;
  healthPath: string;
  basePort: number;
  env: Record<string, string>;
}

export const api = {
  projects: {
    list: () =>
      request<{ projects: Project[] }>("GET", "/api/v1/projects"),
    get: (id: string) =>
      request<{ project: Project }>("GET", `/api/v1/projects/${id}`),
    create: (data: CreateProjectInput) =>
      request<{ project: Project }>("POST", "/api/v1/projects", data),
    delete: (id: string) =>
      request<void>("DELETE", `/api/v1/projects/${id}`),
    metrics: (id: string) =>
      request<ContainerMetrics>("GET", `/api/v1/projects/${id}/metrics`),
    logs: (id: string) =>
      request<LogsResponse>("GET", `/api/v1/projects/${id}/logs`),
    rollback: (id: string) =>
      request<RollbackResult>("POST", `/api/v1/projects/${id}/rollback`),
  },
  deployments: {
    list: () =>
      request<{ deployments: Deployment[] }>("GET", "/api/v1/deployments"),
    deploy: (projectId: string) =>
      request<DeployResult>("POST", "/api/v1/deploy", { projectId }),
  },
};
