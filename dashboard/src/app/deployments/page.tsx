"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api, type Deployment, type Project } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_TABS = [
  { key: "all",         label: "All" },
  { key: "ACTIVE",      label: "Active" },
  { key: "FAILED",      label: "Failed" },
  { key: "ROLLED_BACK", label: "Rolled back" },
  { key: "DEPLOYING",   label: "Deploying" },
] as const;

type StatusKey = typeof STATUS_TABS[number]["key"];

export default function DeploymentsPage() {
  const [deployments, setDeployments]       = useState<Deployment[]>([]);
  const [projects, setProjects]             = useState<Project[]>([]);
  const [loading, setLoading]               = useState(true);
  const [statusFilter, setStatusFilter]     = useState<StatusKey>("all");
  const [projectFilter, setProjectFilter]   = useState("all");

  const fetchData = useCallback(async () => {
    try {
      const [{ deployments: d }, { projects: p }] = await Promise.all([
        api.deployments.list(),
        api.projects.list(),
      ]);
      setDeployments([...d].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setProjects(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  const filtered = deployments
    .filter(d => projectFilter === "all" || d.projectId === projectFilter)
    .filter(d => statusFilter === "all"  || d.status    === statusFilter);

  const statusCounts = {
    ACTIVE:      deployments.filter(d => d.status === "ACTIVE").length,
    FAILED:      deployments.filter(d => d.status === "FAILED").length,
    DEPLOYING:   deployments.filter(d => d.status === "DEPLOYING").length,
    ROLLED_BACK: deployments.filter(d => d.status === "ROLLED_BACK").length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Stats row — consistent with overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",       value: deployments.length,       color: "text-zinc-200" },
          { label: "Active",      value: statusCounts.ACTIVE,      color: "text-emerald-400" },
          { label: "Failed",      value: statusCounts.FAILED,      color: statusCounts.FAILED > 0 ? "text-red-400" : "text-zinc-600" },
          { label: "Rolled back", value: statusCounts.ROLLED_BACK, color: "text-zinc-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-5">
            <p className={`text-3xl font-bold tracking-tight ${color}`}>{value}</p>
            <p className="text-xs text-zinc-500 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-zinc-800">

          {/* Status filter tabs */}
          <div className="flex items-center gap-0.5">
            {STATUS_TABS.map(({ key, label }) => {
              const count = key === "all"
                ? deployments.length
                : statusCounts[key as keyof typeof statusCounts];
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    statusFilter === key
                      ? "bg-zinc-700 text-zinc-100 font-medium"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`text-[10px] tabular-nums ${statusFilter === key ? "text-zinc-300" : "text-zinc-600"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Project filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="divide-y divide-zinc-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="h-3 bg-zinc-800 rounded w-16" />
                <div className="h-3 bg-zinc-800 rounded w-24" />
                <div className="h-5 bg-zinc-800 rounded w-14 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-zinc-600">No deployments found</p>
            {(statusFilter !== "all" || projectFilter !== "all") && (
              <button
                onClick={() => { setStatusFilter("all"); setProjectFilter("all"); }}
                className="mt-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Project", "Version", "Slot", "Container", "Status", "Port", "Deployed"].map((h) => (
                    <th key={h} className="text-left text-zinc-600 font-medium px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((d) => {
                  const proj = projectMap[d.projectId];
                  return (
                    <tr
                      key={d.id}
                      className={`hover:bg-zinc-800/30 transition-colors ${d.status === "FAILED" ? "bg-red-950/10" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        {proj ? (
                          <Link href={`/projects/${proj.id}`} className="text-zinc-300 hover:text-zinc-100 font-medium transition-colors">
                            {proj.name}
                          </Link>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[10px]">{d.projectId.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-zinc-400">v{d.version}</td>
                      <td className="px-5 py-3.5">
                        <span className={`font-semibold ${d.color === "BLUE" ? "text-blue-400" : "text-emerald-400"}`}>
                          {d.color}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-zinc-600 max-w-[140px] truncate">{d.containerName}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={d.status} /></td>
                      <td className="px-5 py-3.5 font-mono text-zinc-500">{d.port}</td>
                      <td className="px-5 py-3.5 text-zinc-500">{timeAgo(d.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
