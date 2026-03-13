"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { PlusCircle, Trash2, GitBranch, ChevronRight, Activity } from "lucide-react";
import { api, type Project, type Deployment, type ServerStats } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// ── Deployment status pie chart ────────────────────────────────────────────
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

  const data = Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  const COLORS: Record<string, string> = {
    ACTIVE: "#818cf8", FAILED: "#f87171", ROLLED_BACK: "#71717a",
    DEPLOYING: "#fbbf24", PENDING: "#3f3f46",
  };

  if (!mounted || data.length === 0) {
    return <div className="h-32 flex items-center justify-center"><span className="text-xs text-muted-foreground/40">No deployment data</span></div>;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PieChart, Pie, Cell, Tooltip, Legend } = require("recharts");
  return (
    <PieChart width={220} height={160}>
      <Pie data={data} cx={80} cy={70} innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value" isAnimationActive={false}>
        {data.map((entry) => <Cell key={entry.name} fill={COLORS[entry.name] ?? "#71717a"} />)}
      </Pie>
      <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: 8, fontSize: 11, fontFamily: "var(--font-poppins)" }} />
      <Legend wrapperStyle={{ fontSize: 10, color: "#52525b", fontFamily: "var(--font-poppins)" }} />
    </PieChart>
  );
}

// ── Deployments per project bar chart ─────────────────────────────────────
function DeploymentsPerProjectChart({ projects, deployments }: { projects: Project[]; deployments: Deployment[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = projects.map(p => ({
    name: p.name.length > 10 ? p.name.slice(0, 10) + "…" : p.name,
    count: deployments.filter(d => d.projectId === p.id).length,
    active: deployments.filter(d => d.projectId === p.id && d.status === "ACTIVE").length,
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count).slice(0, 8);

  if (!mounted || data.length === 0) {
    return <div className="h-32 flex items-center justify-center"><span className="text-xs text-muted-foreground/40">No data</span></div>;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } = require("recharts");
  return (
    <BarChart width={320} height={160} data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#52525b", fontFamily: "var(--font-poppins)" }} tickLine={false} axisLine={false} />
      <YAxis tick={{ fontSize: 10, fill: "#52525b", fontFamily: "var(--font-poppins)" }} tickLine={false} axisLine={false} allowDecimals={false} />
      <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: 8, fontSize: 11, fontFamily: "var(--font-poppins)" }} formatter={(v: number) => [v, "Deployments"]} />
      <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
        {data.map((entry, i) => <Cell key={i} fill={entry.active > 0 ? "#818cf8" : "#3f3f46"} />)}
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
  const indicatorClass =
    value >= 90 ? "bg-red-500" :
    value >= 70 ? "bg-amber-500" :
    "bg-indigo-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">{value.toFixed(1)}%</span>
      </div>
      <Progress value={Math.min(value, 100)} indicatorClassName={indicatorClass} />
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
      const sorted = [...d].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      for (const dep of sorted) {
        if (!map[dep.projectId] || dep.status === "ACTIVE") map[dep.projectId] = dep;
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
    } catch { /* monix not running */ }
  }, []);

  useEffect(() => {
    fetchData();
    fetchServerStats();
    const dataTimer  = setInterval(fetchData, 30_000);
    const statsTimer = setInterval(fetchServerStats, 15_000);
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
  const runningCount   = allDeps.filter(d => d.status === "ACTIVE").length;
  const failedCount    = allDeps.filter(d => d.status === "FAILED").length;
  const deployingCount = allDeps.filter(d => d.status === "DEPLOYING").length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left panel: server health + quick stats ── */}
        <div className="space-y-4">
          {/* Quick stats */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Projects",   value: projects.length,   className: "text-foreground" },
                  { label: "Running",    value: runningCount,      className: "text-indigo-400" },
                  { label: "Failed",     value: failedCount,       className: failedCount > 0 ? "text-red-400" : "text-muted-foreground/40" },
                  { label: "Deploying",  value: deployingCount,    className: deployingCount > 0 ? "text-amber-400" : "text-muted-foreground/40" },
                ].map(({ label, value, className }) => (
                  <div key={label} className="bg-background rounded-lg border border-border px-4 py-4">
                    <p className={`text-3xl font-bold tracking-tight ${className}`}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Server health */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Server Health</CardTitle>
                <Link href="/server" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  Details <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {serverStats && serverStats.status === "ok" ? (
                <div className="space-y-3">
                  <StatMeter label="CPU" value={serverStats.cpu_percent} />
                  <StatMeter label="Memory" value={serverStats.memory_percent} />
                  <StatMeter label="Disk" value={serverStats.disk_percent} />
                  <Separator className="mt-3" />
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-muted-foreground/60">Uptime</span>
                      <p className="text-foreground font-medium mt-0.5">{formatUptime(serverStats.uptime)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground/60">Processes</span>
                      <p className="text-foreground font-medium mt-0.5">{serverStats.process_count}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground/60">Load (1m)</span>
                      <p className="text-foreground font-medium mt-0.5">{serverStats.load_avg[0].toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground/60">Load (5m)</span>
                      <p className="text-foreground font-medium mt-0.5">{serverStats.load_avg[1].toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/40">Monix not running</p>
                  <p className="text-[10px] text-muted-foreground/30 mt-1">Start monix to see server metrics</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right panel: projects list ── */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-medium text-foreground">Projects</span>
                <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0.5">
                  {projects.length}
                </Badge>
              </div>
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="gap-1.5 h-8 text-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                New Project
              </Button>
            </div>

            {/* Project rows */}
            {loading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-5 flex items-center gap-4">
                    <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-1/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div
                className="py-20 text-center cursor-pointer hover:bg-accent/20 transition-colors"
                onClick={() => setCreateOpen(true)}
              >
                <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center mx-auto mb-4">
                  <PlusCircle className="w-5 h-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No projects yet</p>
                <p className="text-xs text-muted-foreground/50 mt-1.5 max-w-[220px] mx-auto leading-relaxed">
                  Create your first project to start zero-downtime deployments
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {projects.map((p) => {
                  const dep = deploymentMap[p.id];
                  const isRunning = dep?.status === "ACTIVE";
                  const isDeploying = dep?.status === "DEPLOYING";
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-accent/20 transition-colors group"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 group-hover:border-border/80 transition-colors">
                        <span className="text-xs font-bold text-muted-foreground uppercase">
                          {p.name.slice(0, 2)}
                        </span>
                      </div>

                      {/* Name + URL */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground/60 font-mono truncate">{p.repoUrl.replace("https://github.com/", "")}</p>
                      </div>

                      {/* Last deploy info */}
                      <div className="hidden sm:block text-right min-w-0 max-w-[160px]">
                        {dep ? (
                          <>
                            <p className="text-xs text-muted-foreground truncate">v{dep.version}</p>
                            <p className="text-xs text-muted-foreground/50">{timeAgo(dep.updatedAt)}</p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground/30">Never deployed</p>
                        )}
                      </div>

                      {/* Branch */}
                      <div className="hidden md:flex items-center gap-1 shrink-0">
                        <GitBranch className="w-3 h-3 text-muted-foreground/40" />
                        <span className="text-xs text-muted-foreground/60 font-mono">{p.branch}</span>
                      </div>

                      {/* Status */}
                      <div className="shrink-0 flex items-center gap-2">
                        {dep ? <StatusBadge status={dep.status} /> : (
                          <span className="text-xs text-muted-foreground/30">—</span>
                        )}
                        {isRunning && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          </span>
                        )}
                        {isDeploying && (
                          <span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => { e.preventDefault(); setDeleteTarget(p); }}
                        className="shrink-0 text-muted-foreground/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Deployment analytics charts ── */}
      {Object.keys(deploymentMap).length > 0 && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Deployment Status</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-2">
                <DeploymentPieChart deployments={Object.values(deploymentMap)} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Deployments per Project</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-2">
                <DeploymentsPerProjectChart projects={projects} deployments={allDeployments} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Recent Activity ── */}
      {allDeployments.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <span className="text-sm font-medium text-foreground">Recent Activity</span>
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {Math.min(allDeployments.length, 8)} of {allDeployments.length}
            </Badge>
          </div>
          <div className="divide-y divide-border/60">
            {allDeployments.slice(0, 8).map((d) => {
              const proj = projects.find(p => p.id === d.projectId);
              const iconColor =
                d.status === "ACTIVE"      ? "text-indigo-400" :
                d.status === "FAILED"      ? "text-red-400" :
                d.status === "ROLLED_BACK" ? "text-muted-foreground" :
                d.status === "DEPLOYING"   ? "text-amber-400" : "text-muted-foreground/40";
              const action =
                d.status === "ACTIVE"      ? "deployed" :
                d.status === "FAILED"      ? "failed" :
                d.status === "ROLLED_BACK" ? "rolled back" :
                d.status === "DEPLOYING"   ? "deploying" : d.status.toLowerCase();
              return (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/20 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                      {(proj?.name ?? "??").slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">
                      <span className="text-foreground font-medium">{proj?.name ?? d.projectId.slice(0, 8)}</span>
                      <span className="text-muted-foreground"> {action} </span>
                      <span className="text-muted-foreground/80 font-mono">v{d.version}</span>
                      <span className={`ml-1.5 font-mono text-[10px] ${d.color === "BLUE" ? "text-blue-400" : "text-indigo-400"}`}>
                        {d.color}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2.5">
                    <StatusBadge status={d.status} />
                    <span className="text-[10px] text-muted-foreground/40 min-w-[40px] text-right">{timeAgo(d.updatedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
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
