"use client";
import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  api,
  type Project,
  type Deployment,
  type ContainerMetrics,
} from "@/lib/api";
import { StatusBadge, ColorBadge, RunningDot } from "./StatusBadge";
import { ConfirmModal } from "./ConfirmModal";
import { MetricsChart, type MetricSample } from "./MetricsChart";
import { LogsViewer } from "./LogsViewer";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KiB", "MiB", "GiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ProjectDetailClient() {
  const pathname = usePathname();
  const router = useRouter();
  // Extract the real project ID from the browser URL (not RSC params — we
  // serve __placeholder__ RSC payloads for all project routes, so useParams()
  // would return "__placeholder__" instead of the actual ID).
  const projectId = pathname.split("/").filter(Boolean)[1] ?? "";

  const [project, setProject] = useState<Project | null>(null);
  const [activeDeployment, setActiveDeployment] = useState<Deployment | null>(null);
  const [metrics, setMetrics] = useState<ContainerMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<MetricSample[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logsUpdated, setLogsUpdated] = useState<Date | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Status ─────────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const [{ project: p }, { deployments }] = await Promise.all([
        api.projects.get(projectId),
        api.deployments.list(),
      ]);
      setProject(p);
      const projectDeps = deployments
        .filter((d) => d.projectId === projectId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      const active =
        projectDeps.find((d) => d.status === "ACTIVE") ??
        projectDeps.find((d) => d.status === "DEPLOYING") ??
        projectDeps[0] ??
        null;
      setActiveDeployment(active);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("404") || msg.includes("not found")) {
        toast.error("Project not found");
        router.push("/");
      }
    } finally {
      setInitialLoading(false);
    }
  }, [projectId, router]);

  // ── Metrics ────────────────────────────────────────────────────────────────
  const fetchMetrics = useCallback(async () => {
    try {
      const m = await api.projects.metrics(projectId);
      setMetrics(m);
      if (m.running) {
        const sample: MetricSample = {
          time: new Date().toLocaleTimeString("en", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          cpu: m.cpu,
          memoryPercent: m.memoryPercent,
          memoryMB: m.memoryUsed / (1024 * 1024),
        };
        setMetricsHistory((prev) => [...prev, sample].slice(-60));
      }
    } catch {
      // Metrics failure must never crash the page — keep last known state
    }
  }, [projectId]);

  // ── Logs ───────────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { lines } = await api.projects.logs(projectId);
      setLogLines(lines);
      setLogsUpdated(new Date());
    } catch {
      // Ignore log errors silently
    } finally {
      setLogsLoading(false);
    }
  }, [projectId]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || projectId === "__placeholder__") return;

    fetchStatus();
    fetchMetrics();
    fetchLogs();

    const statusTimer  = setInterval(fetchStatus,  30_000);
    const metricsTimer = setInterval(fetchMetrics, 30_000);
    const logsTimer    = setInterval(fetchLogs,    15_000);

    return () => {
      clearInterval(statusTimer);
      clearInterval(metricsTimer);
      clearInterval(logsTimer);
    };
  }, [projectId, fetchStatus, fetchMetrics, fetchLogs]);

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleDeploy() {
    setDeploying(true);
    const tid = toast.loading("Deploying...");
    try {
      const result = await api.deployments.deploy(projectId);
      toast.success(result.message, { id: tid });
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deploy failed", { id: tid });
    } finally {
      setDeploying(false);
    }
  }

  async function handleRollback() {
    setRollbackOpen(false);
    setRollingBack(true);
    const tid = toast.loading("Rolling back...");
    try {
      const result = await api.projects.rollback(projectId);
      toast.success(result.message, { id: tid });
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rollback failed", { id: tid });
    } finally {
      setRollingBack(false);
    }
  }

  function handleRefresh() {
    fetchStatus();
    fetchMetrics();
    fetchLogs();
    toast.success("Refreshed", { duration: 1500 });
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-40" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl h-56" />
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl h-56" />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl h-40" />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl h-80" />
      </div>
    );
  }

  if (!project) return null;

  const isDeploying = activeDeployment?.status === "DEPLOYING";
  const containerRunning = metrics?.running ?? activeDeployment?.status === "ACTIVE";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/" className="hover:text-zinc-300 transition-colors">
          Projects
        </Link>
        <span>/</span>
        <span className="text-zinc-300">{project.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── SECTION A: Status Panel ────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">
                {project.name}
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                {project.repoUrl}
              </p>
            </div>
            {activeDeployment && <ColorBadge color={activeDeployment.color} />}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat label="Status">
              {activeDeployment ? (
                <StatusBadge status={activeDeployment.status} />
              ) : (
                <span className="text-xs text-zinc-600">None</span>
              )}
            </Stat>
            <Stat label="Container">
              <RunningDot running={containerRunning} />
            </Stat>
            <Stat label="Active Port">
              <span className="text-sm font-mono text-zinc-300">
                {activeDeployment?.port ?? "—"}
              </span>
            </Stat>
            <Stat label="Version">
              <span className="text-sm text-zinc-300">
                {activeDeployment ? `v${activeDeployment.version}` : "—"}
              </span>
            </Stat>
            <Stat label="Branch">
              <span className="text-sm font-mono text-zinc-300">
                {project.branch}
              </span>
            </Stat>
            <Stat label="Last deploy">
              <span className="text-sm text-zinc-300">
                {activeDeployment ? timeAgo(activeDeployment.updatedAt) : "—"}
              </span>
            </Stat>
          </div>

          {metrics?.running && (
            <div className="mt-5 pt-4 border-t border-zinc-800 grid grid-cols-3 gap-3">
              <MetricTile value={`${metrics.cpu.toFixed(1)}%`} label="CPU" color="text-blue-400" />
              <MetricTile value={formatBytes(metrics.memoryUsed)} label="Memory" color="text-violet-400" />
              <MetricTile value={`${metrics.memoryPercent.toFixed(1)}%`} label="Mem %" color="text-zinc-300" />
            </div>
          )}
        </div>

        {/* ── SECTION B: Controls ────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-400 mb-1">Actions</h2>

          <button
            onClick={handleDeploy}
            disabled={deploying || isDeploying}
            className="w-full py-2.5 px-4 rounded-lg bg-zinc-100 text-zinc-900 font-medium text-sm hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deploying || isDeploying ? (
              <Spinner label={isDeploying ? "Deploying..." : "Triggering..."} />
            ) : (
              "Deploy"
            )}
          </button>

          <button
            onClick={() => setRollbackOpen(true)}
            disabled={rollingBack || !activeDeployment || isDeploying}
            className="w-full py-2.5 px-4 rounded-lg bg-zinc-800 text-zinc-300 font-medium text-sm hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {rollingBack ? <Spinner label="Rolling back..." /> : "Rollback"}
          </button>

          <button
            onClick={handleRefresh}
            className="w-full py-2 px-4 rounded-lg border border-zinc-700 text-zinc-500 text-sm hover:text-zinc-300 hover:border-zinc-600 transition-colors"
          >
            Refresh
          </button>

          <div className="mt-auto pt-4 border-t border-zinc-800 space-y-2">
            <KV k="App port" v={String(project.appPort)} />
            <KV k="Build context" v={project.buildContext} mono />
            <KV k="Health path" v={project.healthPath} />
            <KV k="Container" v={activeDeployment?.containerName ?? "—"} mono truncate />
            <KV k="Image" v={activeDeployment?.imageTag ?? "—"} mono truncate />
          </div>
        </div>
      </div>

      {/* ── SECTION C: Metrics ──────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400">Resource Metrics</h2>
          <span className="text-xs text-zinc-600">
            {metricsHistory.length}/60 samples · polls every 30s
          </span>
        </div>
        <MetricsChart data={metricsHistory} />
      </div>

      {/* ── SECTION D: Logs ─────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <LogsViewer lines={logLines} loading={logsLoading} lastUpdated={logsUpdated} />
      </div>

      <ConfirmModal
        open={rollbackOpen}
        title="Rollback deployment?"
        description={`This will restore the previous deployment for "${project.name}" and stop the current container. This cannot be undone.`}
        confirmLabel="Rollback"
        danger
        onConfirm={handleRollback}
        onCancel={() => setRollbackOpen(false)}
      />
    </div>
  );
}

// ── Presentational helpers ────────────────────────────────────────────────────

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-950 rounded-lg p-3">
      <p className="text-xs text-zinc-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function MetricTile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-600">{label}</p>
    </div>
  );
}

function KV({ k, v, mono = false, truncate = false }: { k: string; v: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span className="text-zinc-600 shrink-0">{k}</span>
      <span className={`text-zinc-400 ${mono ? "font-mono" : ""} ${truncate ? "truncate max-w-[120px]" : ""}`}>
        {v}
      </span>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      {label}
    </span>
  );
}
