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
import { StatusBadge, RunningDot } from "./StatusBadge";
import { ConfirmModal } from "./ConfirmModal";
import { MetricsChart, type MetricSample } from "./MetricsChart";
import { LogsViewer } from "./LogsViewer";

// ── Constants ─────────────────────────────────────────────────────────────────
const HEALTH_PATH_OPTIONS = [
  { value: "/health",     label: "Standard — /health" },
  { value: "/healthz",    label: "Kubernetes — /healthz" },
  { value: "/api/health", label: "API prefix — /api/health" },
  { value: "/status",     label: "Status — /status" },
  { value: "/ping",       label: "Ping — /ping" },
  { value: "/ready",      label: "Readiness — /ready" },
  { value: "/",           label: "Root — /" },
];

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
  const projectId = pathname.split("/").filter(Boolean)[1] ?? "";

  const [project, setProject] = useState<Project | null>(null);
  const [activeDeployment, setActiveDeployment] = useState<Deployment | null>(null);
  const [blueDeployment, setBlueDeployment] = useState<Deployment | null>(null);
  const [greenDeployment, setGreenDeployment] = useState<Deployment | null>(null);
  const [deploymentHistory, setDeploymentHistory] = useState<Deployment[]>([]);
  const [metrics, setMetrics] = useState<ContainerMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<MetricSample[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logsUpdated, setLogsUpdated] = useState<Date | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState(-1); // -1 = not visible; 0-4 = current step
  const [deployFailed, setDeployFailed] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ branch: "", buildContext: "", appPort: "", healthPath: "", basePort: "" });

  // Env editor
  const [envRows, setEnvRows] = useState<{ key: string; value: string }[]>([]);
  const [savingEnv, setSavingEnv] = useState(false);

  // ── Status ─────────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const [{ project: p }, { deployments }] = await Promise.all([
        api.projects.get(projectId),
        api.deployments.list(),
      ]);
      setProject(p);

      // Seed settings form + env rows on first load (don't overwrite user edits)
      setSettingsForm((prev) =>
        prev.branch === ""
          ? { branch: p.branch, buildContext: p.buildContext ?? ".", appPort: String(p.appPort), healthPath: p.healthPath, basePort: String(p.basePort) }
          : prev
      );
      setEnvRows((prev) =>
        prev.length === 0
          ? Object.entries(p.env ?? {}).map(([key, value]) => ({ key, value }))
          : prev
      );

      const projectDeps = deployments
        .filter((d) => d.projectId === projectId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const active =
        projectDeps.find((d) => d.status === "ACTIVE") ??
        projectDeps.find((d) => d.status === "DEPLOYING") ??
        projectDeps[0] ??
        null;
      setActiveDeployment(active);

      // Track the latest deployment for each slot
      setBlueDeployment(projectDeps.find((d) => d.color === "BLUE") ?? null);
      setGreenDeployment(projectDeps.find((d) => d.color === "GREEN") ?? null);
      setDeploymentHistory(projectDeps.slice(0, 10));
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
          time: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          cpu: m.cpu,
          memoryPercent: m.memoryPercent,
          memoryMB: m.memoryUsed / (1024 * 1024),
          netInKB:  (m.netIn  ?? 0) / 1024,
          netOutKB: (m.netOut ?? 0) / 1024,
        };
        setMetricsHistory((prev) => [...prev, sample].slice(-60));
      }
    } catch {
      // keep last known state
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
      // ignore
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
    setDeployStep(0);
    setDeployFailed(false);

    // Simulate step advancement while waiting for the API call
    // Steps: 0=Pulling, 1=Building, 2=Starting, 3=Health check, 4=Traffic switch
    const t1 = setTimeout(() => setDeployStep(1), 4_000);   // →Building
    const t2 = setTimeout(() => setDeployStep(2), 20_000);  // →Starting
    const t3 = setTimeout(() => setDeployStep(3), 24_000);  // →Health check

    const tid = toast.loading("Deploying...");
    try {
      const result = await api.deployments.deploy(projectId);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setDeployStep(4); // Traffic switch
      setTimeout(() => setDeployStep(5), 900); // mark all done
      toast.success(result.message, { id: tid });
      await fetchStatus();
    } catch (err) {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setDeployFailed(true);
      toast.error(err instanceof Error ? err.message : "Deploy failed", { id: tid });
    } finally {
      setDeploying(false);
      // Keep panel visible for 3s after completion/failure, then hide
      setTimeout(() => {
        setDeployStep(-1);
        setDeployFailed(false);
      }, 3_000);
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

  async function handleDelete() {
    setDeleteOpen(false);
    setDeleting(true);
    const tid = toast.loading("Deleting project...");
    try {
      await api.projects.delete(projectId);
      toast.success(`Project "${project?.name}" deleted`, { id: tid });
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed", { id: tid });
      setDeleting(false);
    }
  }

  function handleRefresh() {
    fetchStatus();
    fetchMetrics();
    fetchLogs();
    toast.success("Refreshed", { duration: 1500 });
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    const tid = toast.loading("Saving settings...");
    try {
      await api.projects.update(projectId, {
        branch: settingsForm.branch.trim() || undefined,
        buildContext: settingsForm.buildContext.trim() || undefined,
        appPort: settingsForm.appPort ? parseInt(settingsForm.appPort, 10) : undefined,
        healthPath: settingsForm.healthPath.trim() || undefined,
        basePort: settingsForm.basePort ? parseInt(settingsForm.basePort, 10) : undefined,
      });
      toast.success("Settings saved", { id: tid });
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed", { id: tid });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveEnv() {
    setSavingEnv(true);
    const tid = toast.loading("Saving env vars...");
    try {
      const env: Record<string, string> = {};
      for (const row of envRows) {
        if (row.key.trim()) env[row.key.trim()] = row.value;
      }
      await api.projects.updateEnv(projectId, env);
      toast.success("Environment variables saved", { id: tid });
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed", { id: tid });
    } finally {
      setSavingEnv(false);
    }
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl h-32" />
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
        <Link href="/" className="hover:text-zinc-300 transition-colors">Projects</Link>
        <span>/</span>
        <span className="text-zinc-300">{project.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Status Panel ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">{project.name}</h1>
              <p className="text-xs text-zinc-500 mt-0.5 font-mono">{project.repoUrl}</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                branch: <span className="text-zinc-400 font-mono">{project.branch}</span>
                {project.buildContext !== "." && (
                  <> · context: <span className="text-zinc-400 font-mono">{project.buildContext}</span></>
                )}
              </p>
            </div>
            <RunningDot running={containerRunning} />
          </div>

          {/* Error banner — shown when latest deployment failed */}
          {activeDeployment?.status === "FAILED" && activeDeployment.errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-lg bg-red-950/30 border border-red-800/40 px-4 py-3">
              <span className="text-red-400 text-sm shrink-0 mt-0.5">✕</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-400 mb-0.5">Deployment failed</p>
                <p className="text-xs text-red-300/70 font-mono break-words">{activeDeployment.errorMessage}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat label="Status">
              {activeDeployment
                ? <StatusBadge status={activeDeployment.status} />
                : <span className="text-xs text-zinc-600">None</span>}
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
            <Stat label="Last deploy">
              <span className="text-sm text-zinc-300">
                {activeDeployment ? timeAgo(activeDeployment.updatedAt) : "—"}
              </span>
            </Stat>
            <Stat label="App port">
              <span className="text-sm font-mono text-zinc-300">{project.appPort}</span>
            </Stat>
            <Stat label="Health path">
              <span className="text-sm font-mono text-zinc-300">{project.healthPath}</span>
            </Stat>
          </div>

          {metrics?.running && (
            <div className="mt-5 pt-4 border-t border-zinc-800 grid grid-cols-3 sm:grid-cols-6 gap-3">
              <MetricTile value={`${metrics.cpu.toFixed(1)}%`} label="CPU" color="text-blue-400" />
              <MetricTile value={formatBytes(metrics.memoryUsed)} label="Memory" color="text-violet-400" />
              <MetricTile value={`${metrics.memoryPercent.toFixed(1)}%`} label="Mem %" color="text-zinc-300" />
              <MetricTile value={formatBytes(metrics.netIn ?? 0)} label="Net RX" color="text-emerald-400" />
              <MetricTile value={formatBytes(metrics.netOut ?? 0)} label="Net TX" color="text-orange-400" />
              <MetricTile value={String(metrics.pids ?? 0)} label="PIDs" color="text-zinc-400" />
            </div>
          )}
        </div>

        {/* ── Actions Panel ────────────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-400 mb-1">Actions</h2>

          <button
            onClick={handleDeploy}
            disabled={deploying || isDeploying}
            className="w-full py-2.5 px-4 rounded-lg bg-zinc-100 text-zinc-900 font-medium text-sm hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deploying || isDeploying
              ? <Spinner label={isDeploying ? "Deploying..." : "Triggering..."} />
              : "Deploy"}
          </button>

          <button
            onClick={() => setRollbackOpen(true)}
            disabled={rollingBack || !activeDeployment || isDeploying}
            className="w-full py-2.5 px-4 rounded-lg bg-zinc-800 text-zinc-300 font-medium text-sm hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {rollingBack ? <Spinner label="Rolling back..." /> : "Rollback"}
          </button>

          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="w-full py-2 px-4 rounded-lg border border-zinc-700 text-zinc-500 text-sm hover:text-zinc-300 hover:border-zinc-600 transition-colors"
          >
            {settingsOpen ? "Hide Settings" : "Settings"}
          </button>

          <button
            onClick={handleRefresh}
            className="w-full py-2 px-4 rounded-lg border border-zinc-700 text-zinc-500 text-sm hover:text-zinc-300 hover:border-zinc-600 transition-colors"
          >
            Refresh
          </button>

          {/* Settings inline form */}
          {settingsOpen && (
            <div className="pt-3 border-t border-zinc-800 space-y-3">
              <p className="text-xs font-medium text-zinc-400">Project Settings</p>
              <SField label="Branch">
                <input
                  type="text"
                  value={settingsForm.branch}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, branch: e.target.value }))}
                  className={sinput}
                />
              </SField>
              <SField label="Build context">
                <input
                  type="text"
                  value={settingsForm.buildContext}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, buildContext: e.target.value }))}
                  placeholder="."
                  className={sinput}
                />
              </SField>
              <SField label="App port">
                <input
                  type="number"
                  value={settingsForm.appPort}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, appPort: e.target.value }))}
                  className={sinput}
                />
              </SField>
              <SField label="Health path">
                <input
                  type="text"
                  list="s-health-path-opts"
                  value={settingsForm.healthPath}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, healthPath: e.target.value }))}
                  placeholder="/health"
                  className={sinput}
                />
                <datalist id="s-health-path-opts">
                  {HEALTH_PATH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} label={o.label} />
                  ))}
                </datalist>
              </SField>
              <SField label="Base port">
                <input
                  type="number"
                  value={settingsForm.basePort}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, basePort: e.target.value }))}
                  className={sinput}
                />
              </SField>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full py-1.5 text-xs rounded-lg bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors disabled:opacity-40"
              >
                {savingSettings ? <Spinner label="Saving..." /> : "Save settings"}
              </button>
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-zinc-800 space-y-2">
            <KV k="Container" v={activeDeployment?.containerName ?? "—"} mono truncate />
            <KV k="Image" v={activeDeployment?.imageTag ?? "—"} mono truncate />
          </div>

          {/* Danger zone */}
          <div className="pt-4 border-t border-zinc-800">
            <button
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
              className="w-full py-2 px-4 rounded-lg border border-red-900/50 text-red-500 text-sm hover:bg-red-950/40 hover:border-red-700/50 transition-colors disabled:opacity-40"
            >
              {deleting ? <Spinner label="Deleting..." /> : "Delete project"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Deploy Progress ──────────────────────────────────────────────────── */}
      {deployStep >= 0 && (
        <DeployProgressPanel step={deployStep} failed={deployFailed} />
      )}

      {/* ── Blue / Green Slots ───────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-medium text-zinc-400">Deployment Slots</h2>
          <span className="text-xs text-zinc-600">
            base port {project.basePort} · {project.basePort + 1}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DeploymentSlot
            color="BLUE"
            deployment={blueDeployment}
            basePort={project.basePort}
            isActive={activeDeployment?.color === "BLUE"}
          />
          <DeploymentSlot
            color="GREEN"
            deployment={greenDeployment}
            basePort={project.basePort + 1}
            isActive={activeDeployment?.color === "GREEN"}
          />
        </div>

        {/* Traffic indicator */}
        {activeDeployment && (
          <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-3">
            <span className="text-xs text-zinc-600">Traffic routing</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500">nginx upstream</span>
              <span className="text-xs text-zinc-700">→</span>
              <span className={`text-xs font-semibold font-mono ${activeDeployment.color === "BLUE" ? "text-blue-400" : "text-emerald-400"}`}>
                {activeDeployment.containerName}
              </span>
              <span className="text-xs text-zinc-600">:{activeDeployment.port}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Deployment History ───────────────────────────────────────────────── */}
      {deploymentHistory.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-400">Deployment History</h2>
            <span className="text-xs text-zinc-600">last {deploymentHistory.length} deployments</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Version", "Slot", "Container", "Status", "Port", "Deployed", "Error"].map((h) => (
                    <th key={h} className="text-left text-zinc-600 font-medium pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {deploymentHistory.map((d) => (
                  <tr key={d.id} className={`hover:bg-zinc-800/30 transition-colors ${d.status === "FAILED" ? "bg-red-950/10" : ""}`}>
                    <td className="py-2 pr-4 font-mono text-zinc-300">v{d.version}</td>
                    <td className="py-2 pr-4">
                      <span className={`font-semibold ${d.color === "BLUE" ? "text-blue-400" : "text-emerald-400"}`}>
                        {d.color}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-zinc-500 max-w-[140px] truncate">{d.containerName}</td>
                    <td className="py-2 pr-4"><StatusBadge status={d.status} /></td>
                    <td className="py-2 pr-4 font-mono text-zinc-500">{d.port}</td>
                    <td className="py-2 pr-4 text-zinc-500">{timeAgo(d.updatedAt)}</td>
                    <td className="py-2 max-w-[200px]">
                      {d.errorMessage ? (
                        <span
                          className="text-xs text-red-400/70 font-mono truncate block"
                          title={d.errorMessage}
                        >
                          {d.errorMessage}
                        </span>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Environment Variables ────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400">Environment Variables</h2>
          <button
            type="button"
            onClick={() => setEnvRows((prev) => [...prev, { key: "", value: "" }])}
            className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded px-2 py-0.5 transition-colors"
          >
            + Add
          </button>
        </div>

        {envRows.length === 0 ? (
          <p className="text-xs text-zinc-700 py-2">No env vars set. Click Add to inject variables into the next deployment.</p>
        ) : (
          <div className="space-y-2">
            {envRows.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) => setEnvRows((prev) => prev.map((r, idx) => idx === i ? { ...r, key: e.target.value } : r))}
                  placeholder="KEY"
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                />
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => setEnvRows((prev) => prev.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r))}
                  placeholder="value"
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => setEnvRows((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-zinc-600 hover:text-red-400 transition-colors text-sm px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSaveEnv}
            disabled={savingEnv}
            className="px-4 py-1.5 text-xs rounded-lg bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors disabled:opacity-40"
          >
            {savingEnv ? <Spinner label="Saving..." /> : "Save env vars"}
          </button>
        </div>
      </div>

      {/* ── Resource Metrics ─────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400">Resource Metrics</h2>
          <span className="text-xs text-zinc-600">{metricsHistory.length}/60 samples · polls every 30s</span>
        </div>
        <MetricsChart data={metricsHistory} />
      </div>

      {/* ── Logs ─────────────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <LogsViewer lines={logLines} loading={logsLoading} lastUpdated={logsUpdated} />
      </div>

      <ConfirmModal
        open={rollbackOpen}
        title="Rollback deployment?"
        description={`This will restore the previous deployment for "${project.name}" and stop the current container.`}
        confirmLabel="Rollback"
        danger
        onConfirm={handleRollback}
        onCancel={() => setRollbackOpen(false)}
      />

      <ConfirmModal
        open={deleteOpen}
        title="Delete project?"
        description={`This will permanently delete "${project.name}" and all its deployment records. Running containers will not be stopped automatically.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

// ── Deploy Progress Panel ─────────────────────────────────────────────────────

const DEPLOY_STEPS = [
  { label: "Pulling source",     description: "Cloning / updating git repository" },
  { label: "Building image",     description: "Running docker build" },
  { label: "Starting container", description: "Running new container" },
  { label: "Health check",       description: "Waiting for app to respond" },
  { label: "Switching traffic",  description: "Updating nginx upstream" },
];

function DeployProgressPanel({ step, failed }: { step: number; failed: boolean }) {
  const done = step >= DEPLOY_STEPS.length;
  return (
    <div className={`bg-zinc-900 border rounded-xl p-5 transition-colors duration-500 ${
      failed ? "border-red-800/60" : done ? "border-emerald-800/40" : "border-zinc-800"
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-zinc-400">Deploy Progress</h2>
        {done && !failed && (
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">✓</span>
            Complete
          </span>
        )}
        {failed && (
          <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center text-[10px]">✕</span>
            Failed
          </span>
        )}
        {!done && !failed && (
          <span className="text-xs text-zinc-600">
            Step {Math.min(step + 1, DEPLOY_STEPS.length)} of {DEPLOY_STEPS.length}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {DEPLOY_STEPS.map((s, i) => {
          const isActive  = i === step && !done && !failed;
          const isDone    = i < step || done;
          const isFailed  = failed && i === step;
          const isPending = !isDone && !isActive && !isFailed;

          return (
            <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
              isActive ? "bg-zinc-800/70" : "bg-transparent"
            }`}>
              {/* Step icon */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors ${
                isDone    ? "bg-emerald-500/20 text-emerald-400" :
                isFailed  ? "bg-red-500/20 text-red-400" :
                isActive  ? "bg-blue-500/20 text-blue-400" :
                            "bg-zinc-800 text-zinc-600"
              }`}>
                {isDone   ? "✓" :
                 isFailed ? "✕" :
                 isActive ? (
                   <span className="w-2.5 h-2.5 border border-blue-400 border-t-transparent rounded-full animate-spin block" />
                 ) : String(i + 1)}
              </div>

              {/* Step text */}
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${
                  isDone    ? "text-zinc-400 line-through" :
                  isFailed  ? "text-red-400" :
                  isActive  ? "text-zinc-100" :
                              "text-zinc-600"
                }`}>
                  {s.label}
                </span>
                {isActive && (
                  <span className="block text-xs text-zinc-500 mt-0.5">{s.description}</span>
                )}
              </div>

              {/* Duration indicator */}
              {isDone && (
                <span className="text-xs text-zinc-600 shrink-0">done</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {!failed && (
        <div className="mt-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${done ? "bg-emerald-500" : "bg-blue-500"}`}
            style={{ width: `${done ? 100 : (Math.min(step, DEPLOY_STEPS.length) / DEPLOY_STEPS.length) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Blue/Green Slot Card ──────────────────────────────────────────────────────

function DeploymentSlot({
  color,
  deployment,
  basePort,
  isActive,
}: {
  color: "BLUE" | "GREEN";
  deployment: Deployment | null;
  basePort: number;
  isActive: boolean;
}) {
  const isBlue = color === "BLUE";

  const activeRing = isBlue
    ? "border-blue-500/50 shadow-[0_0_24px_rgba(59,130,246,0.12)] bg-blue-500/[0.03]"
    : "border-emerald-500/50 shadow-[0_0_24px_rgba(16,185,129,0.12)] bg-emerald-500/[0.03]";

  const dotColor    = isBlue ? "bg-blue-400" : "bg-emerald-400";
  const labelColor  = isBlue ? "text-blue-400" : "text-emerald-400";
  const badgeColor  = isBlue ? "bg-blue-500 text-white" : "bg-emerald-500 text-white";

  return (
    <div className={`relative rounded-xl border p-5 transition-all duration-500 ${isActive ? activeRing : "border-zinc-800 bg-zinc-950"}`}>

      {/* LIVE pill */}
      {isActive && (
        <span className={`absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${badgeColor}`}>
          LIVE
        </span>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            {isActive && deployment?.status === "ACTIVE" && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-50`} />
            )}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${dotColor} ${!isActive ? "opacity-30" : ""}`} />
          </span>
          <span className={`text-sm font-bold tracking-wide ${labelColor}`}>{color}</span>
        </div>
        <span className="text-xs font-mono text-zinc-500">:{basePort}</span>
      </div>

      {/* Body */}
      {deployment ? (
        <div className="space-y-2">
          <Row k="Version" v={`v${deployment.version}`} mono />
          <Row k="Container" v={deployment.containerName} mono truncate />
          <Row k="Image" v={deployment.imageTag} mono truncate />
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-600">Status</span>
            <StatusBadge status={deployment.status} />
          </div>
          <Row k="Deployed" v={timeAgo(deployment.updatedAt)} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 gap-1">
          <span className="text-xs text-zinc-700">No deployment in this slot</span>
        </div>
      )}
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
      <span className={`text-zinc-400 ${mono ? "font-mono" : ""} ${truncate ? "truncate max-w-[120px]" : ""}`}>{v}</span>
    </div>
  );
}

function Row({ k, v, mono = false, truncate = false }: { k: string; v: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs gap-2">
      <span className="text-zinc-600 shrink-0">{k}</span>
      <span className={`text-zinc-300 ${mono ? "font-mono" : ""} ${truncate ? "truncate max-w-[140px]" : ""}`}>{v}</span>
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

const sinput = "w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500";

function SField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
