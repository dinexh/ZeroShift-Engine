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
  netIn: number;
  netOut: number;
  blockIn: number;
  blockOut: number;
  pids: number;
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

export interface UpdateProjectInput {
  branch?: string;
  buildContext?: string;
  appPort?: number;
  healthPath?: string;
  basePort?: number;
}

export interface ServerStats {
  status: "ok" | "unavailable";
  cpu_percent: number;
  memory_percent: number;
  memory_used: number;
  memory_total: number;
  disk_percent: number;
  disk_used: number;
  disk_total: number;
  network_sent: number;
  network_recv: number;
  network_sent_rate: number;
  network_recv_rate: number;
  uptime: number;
  load_avg: [number, number, number];
  process_count: number;
  timestamp: string;
}

export interface MonixConnection {
  local_address?: string;
  remote_address?: string;
  state?: string;
  pid?: number;
  process?: string;
}

export interface MonixAlert {
  type?: string;
  message?: string;
  severity?: string;
  timestamp?: string;
}

export interface MonixProcess {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
}

export interface ServerDashboard {
  status: "ok" | "unavailable";
  system_stats: ServerStats;
  connections: MonixConnection[];
  top_processes: MonixProcess[];
  alerts: MonixAlert[];
}

export const api = {
  projects: {
    list: () =>
      request<{ projects: Project[] }>("GET", "/api/v1/projects"),
    get: (id: string) =>
      request<{ project: Project }>("GET", `/api/v1/projects/${id}`),
    create: (data: CreateProjectInput) =>
      request<{ project: Project }>("POST", "/api/v1/projects", data),
    update: (id: string, data: UpdateProjectInput) =>
      request<{ project: Project }>("PATCH", `/api/v1/projects/${id}`, data),
    updateEnv: (id: string, env: Record<string, string>) =>
      request<{ project: Project }>("PATCH", `/api/v1/projects/${id}/env`, { env }),
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
  system: {
    serverStats: () =>
      request<ServerStats>("GET", "/api/v1/system/server-stats"),
    serverDashboard: () =>
      request<ServerDashboard>("GET", "/api/v1/system/server-dashboard"),
  },
};
