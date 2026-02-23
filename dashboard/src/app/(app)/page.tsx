"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api, type Project, type Deployment, type ServerStats } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { ConfirmModal } from "@/components/ConfirmModal";

// ── Deployment status pie chart ───────────────────────────────────────────────
function DeploymentPieChart({ deployments }: { deployments: Deployment[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const counts = {
    ACTIVE:      deployments.filter(d => d.status === "ACTIVE").length,
    FAILED:      deployments.filter(d => d.status === "FAILED").length,
    ROLLED_BACK: deployments.filter(d => d.status === "ROLLED_BACK").length,
    DEPLOYING:   deployments.filter(d => d.status === "DEPLOYING").length,
    PENDING:     deployments.filter(d => d.status === "PENDING").length,
  };

  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const COLORS: Record<string, string> = {
    ACTIVE: "#34d399", FAILED: "#f87171", ROLLED_BACK: "#71717a",
    DEPLOYING: "#fbbf24", PENDING: "#52525b",
  };

  if (!mounted || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-zinc-700">No deployment data</span>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PieChart, Pie, Cell, Tooltip, Legend } = require("recharts");
  return (
    <PieChart width={220} height={160}>
      <Pie data={data} cx={80} cy={70} innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value" isAnimationActive={false}>
        {data.map((entry) => <Cell key={entry.name} fill={COLORS[entry.name] ?? "#71717a"} />)}
      </Pie>
      <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 11 }} />
      <Legend wrapperStyle={{ fontSize: 10, color: "#71717a" }} />
    </PieChart>
  );
}

// ── Deployments per project bar chart ─────────────────────────────────────────
function DeploymentsPerProjectChart({ projects, deployments }: { projects: Project[]; deployments: Deployment[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = projects.map(p => ({
    name: p.name.length > 10 ? p.name.slice(0, 10) + "…" : p.name,
    count: deployments.filter(d => d.projectId === p.id).length,
    active: deployments.filter(d => d.projectId === p.id && d.status === "ACTIVE").length,
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count).slice(0, 8);

  if (!mounted || data.length === 0) {
    return <div className="h-32 flex items-center justify-center"><span className="text-xs text-zinc-700">No data</span></div>;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } = require("recharts");
  return (
    <BarChart width={320} height={160} data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
      <YAxis tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} allowDecimals={false} />
      <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 11 }} formatter={(v: number) => [v, "Deployments"]} />
      <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
        {data.map((entry, i) => <Cell key={i} fill={entry.active > 0 ? "#34d399" : "#52525b"} />)}
      </Bar>
    </BarChart>
  );
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

function StatMeter({ label, value }: { label: string; value: number }) {
  const color =
    value >= 90 ? "bg-red-500" :
    value >= 70 ? "bg-amber-500" :
    "bg-emerald-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-300 font-medium">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function OverviewPage() {
  const [projects, setProjects]         = useState<Project[]>([]);
  const [deploymentMap, setDeploymentMap] = useState<Record<string, Deployment>>({});
  const [allDeployments, setAllDeployments] = useState<Deployment[]>([]);
  const [serverStats, setServerStats]   = useState<ServerStats | null>(null);
  const [loading, setLoading]           = useState(true);
  const [createOpen, setCreateOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [{ projects: p }, { deployments: d }] = await Promise.all([
        api.projects.list(),
        api.deployments.list(),
      ]);

      const map: Record<string, Deployment> = {};
      const sorted = [...d].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      for (const dep of sorted) {
        if (!map[dep.projectId] || dep.status === "ACTIVE") {
          map[dep.projectId] = dep;
        }
      }
      setProjects(p);
      setDeploymentMap(map);
      setAllDeployments(d);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchServerStats = useCallback(async () => {
    try {
      const stats = await api.system.serverStats();
      setServerStats(stats);
    } catch {
      // monix not running — keep null
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchServerStats();
    const dataTimer   = setInterval(fetchData, 30_000);
    const statsTimer  = setInterval(fetchServerStats, 15_000);
    return () => { clearInterval(dataTimer); clearInterval(statsTimer); };
  }, [fetchData, fetchServerStats]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const tid = toast.loading(`Deleting "${deleteTarget.name}"...`);
    try {
      await api.projects.delete(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted`, { id: tid });
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed", { id: tid });
    } finally {
      setDeleting(false);
    }
  }

  const allDeps = Object.values(deploymentMap);
  const runningCount   = allDeps.filter((d) => d.status === "ACTIVE").length;
  const failedCount    = allDeps.filter((d) => d.status === "FAILED").length;
  const deployingCount = allDeps.filter((d) => d.status === "DEPLOYING").length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left panel: server health + quick stats ── */}
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Overview</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Projects",   value: projects.length,   color: "text-zinc-200" },
                { label: "Running",    value: runningCount,      color: "text-emerald-400" },
                { label: "Failed",     value: failedCount,       color: failedCount > 0 ? "text-red-400" : "text-zinc-600" },
                { label: "Deploying",  value: deployingCount,    color: deployingCount > 0 ? "text-amber-400" : "text-zinc-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-zinc-950 rounded-lg px-4 py-5">
                  <p className={`text-3xl font-bold tracking-tight ${color}`}>{value}</p>
                  <p className="text-xs text-zinc-500 mt-1.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Server health */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Server Health</p>
              <Link href="/server" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                Details →
              </Link>
            </div>
            {serverStats && serverStats.status === "ok" ? (
              <div className="space-y-3">
                <StatMeter label="CPU" value={serverStats.cpu_percent} />
                <StatMeter label="Memory" value={serverStats.memory_percent} />
                <StatMeter label="Disk" value={serverStats.disk_percent} />
                <div className="pt-2 border-t border-zinc-800 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-600">Uptime</span>
                    <p className="text-zinc-300 font-medium">{formatUptime(serverStats.uptime)}</p>
                  </div>
                  <div>
                    <span className="text-zinc-600">Processes</span>
                    <p className="text-zinc-300 font-medium">{serverStats.process_count}</p>
                  </div>
                  <div>
                    <span className="text-zinc-600">Load (1m)</span>
                    <p className="text-zinc-300 font-medium">{serverStats.load_avg[0].toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-zinc-600">Load (5m)</span>
                    <p className="text-zinc-300 font-medium">{serverStats.load_avg[1].toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-xs text-zinc-700">Monix not running</p>
                <p className="text-[10px] text-zinc-800 mt-1">Start monix to see server metrics</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: projects list ── */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-medium text-zinc-300">Projects</span>
                <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
                  {projects.length}
                </span>
              </div>
              <button
                onClick={() => setCreateOpen(true)}
                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors"
              >
                + New Project
              </button>
            </div>

            {/* Project rows */}
            {loading ? (
              <div className="divide-y divide-zinc-800">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-5 flex items-center gap-4 animate-pulse">
                    <div className="w-9 h-9 bg-zinc-800 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-zinc-800 rounded w-1/4" />
                      <div className="h-2.5 bg-zinc-800 rounded w-1/2" />
                    </div>
                    <div className="h-5 bg-zinc-800 rounded w-16" />
                  </div>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div
                className="py-20 text-center cursor-pointer hover:bg-zinc-800/20 transition-colors"
                onClick={() => setCreateOpen(true)}
              >
                <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl text-zinc-500">+</span>
                </div>
                <p className="text-sm font-medium text-zinc-400">No projects yet</p>
                <p className="text-xs text-zinc-600 mt-1.5 max-w-[220px] mx-auto leading-relaxed">
                  Create your first project to start zero-downtime deployments
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {projects.map((p) => {
                  const dep = deploymentMap[p.id];
                  const isRunning = dep?.status === "ACTIVE";
                  const isDeploying = dep?.status === "DEPLOYING";
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-4 px-5 py-5 hover:bg-zinc-800/40 transition-colors group"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 group-hover:border-zinc-600 transition-colors">
                        <span className="text-xs font-bold text-zinc-400 uppercase">
                          {p.name.slice(0, 2)}
                        </span>
                      </div>

                      {/* Name + URL */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{p.name}</p>
                        <p className="text-xs text-zinc-600 font-mono truncate">{p.repoUrl.replace("https://github.com/", "")}</p>
                      </div>

                      {/* Last deploy info */}
                      <div className="hidden sm:block text-right min-w-0 max-w-[160px]">
                        {dep ? (
                          <>
                            <p className="text-xs text-zinc-400 truncate">v{dep.version}</p>
                            <p className="text-xs text-zinc-600">{timeAgo(dep.updatedAt)}</p>
                          </>
                        ) : (
                          <p className="text-xs text-zinc-700">Never deployed</p>
                        )}
                      </div>

                      {/* Branch */}
                      <div className="hidden md:flex items-center gap-1 shrink-0">
                        <span className="text-xs text-zinc-600">⎇</span>
                        <span className="text-xs text-zinc-500 font-mono">{p.branch}</span>
                      </div>

                      {/* Status */}
                      <div className="shrink-0 flex items-center gap-2">
                        {dep ? <StatusBadge status={dep.status} /> : (
                          <span className="text-xs text-zinc-700">—</span>
                        )}
                        {isRunning && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          </span>
                        )}
                        {isDeploying && (
                          <span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => { e.preventDefault(); setDeleteTarget(p); }}
                        className="shrink-0 text-zinc-700 hover:text-red-400 transition-colors text-xs px-1 opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Deployment analytics charts ── */}
      {Object.keys(deploymentMap).length > 0 && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-5">Deployment Status</p>
            <div className="flex items-center justify-center py-2">
              <DeploymentPieChart deployments={Object.values(deploymentMap)} />
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-5">Deployments per Project</p>
            <div className="flex items-center justify-center py-2">
              <DeploymentsPerProjectChart projects={projects} deployments={allDeployments} />
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Activity ───────────────────────────────────────────────────── */}
      {allDeployments.length > 0 && (
        <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <span className="text-sm font-medium text-zinc-300">Recent Activity</span>
            <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
              {Math.min(allDeployments.length, 8)} of {allDeployments.length}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {allDeployments.slice(0, 8).map((d) => {
              const proj = projects.find(p => p.id === d.projectId);
              const icon =
                d.status === "ACTIVE"      ? "↑" :
                d.status === "FAILED"      ? "✕" :
                d.status === "ROLLED_BACK" ? "⟳" :
                d.status === "DEPLOYING"   ? "◌" : "·";
              const iconColor =
                d.status === "ACTIVE"      ? "text-emerald-400" :
                d.status === "FAILED"      ? "text-red-400" :
                d.status === "ROLLED_BACK" ? "text-zinc-500" :
                d.status === "DEPLOYING"   ? "text-amber-400" : "text-zinc-600";
              const action =
                d.status === "ACTIVE"      ? "deployed" :
                d.status === "FAILED"      ? "failed" :
                d.status === "ROLLED_BACK" ? "rolled back" :
                d.status === "DEPLOYING"   ? "deploying" : d.status.toLowerCase();
              return (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                  <span className={`text-sm font-mono shrink-0 w-4 text-center ${iconColor}`}>{icon}</span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">
                      {(proj?.name ?? "??").slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">
                      <span className="text-zinc-200 font-medium">{proj?.name ?? d.projectId.slice(0, 8)}</span>
                      <span className="text-zinc-500"> {action} </span>
                      <span className="text-zinc-400 font-mono">v{d.version}</span>
                      <span className={`ml-1.5 font-mono text-[10px] ${d.color === "BLUE" ? "text-blue-400" : "text-emerald-400"}`}>
                        {d.color}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2.5">
                    <StatusBadge status={d.status} />
                    <span className="text-[10px] text-zinc-600 min-w-[40px] text-right">{timeAgo(d.updatedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchData}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This will permanently delete the project and all its deployment records."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
