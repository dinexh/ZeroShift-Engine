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

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [projects, setProjects]       = useState<Project[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState("all");

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
  const filtered = filter === "all"
    ? deployments
    : deployments.filter((d) => d.projectId === filter);

  const statusCounts = {
    ACTIVE:      deployments.filter((d) => d.status === "ACTIVE").length,
    FAILED:      deployments.filter((d) => d.status === "FAILED").length,
    DEPLOYING:   deployments.filter((d) => d.status === "DEPLOYING").length,
    ROLLED_BACK: deployments.filter((d) => d.status === "ROLLED_BACK").length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",       value: deployments.length,       color: "text-zinc-200" },
          { label: "Active",      value: statusCounts.ACTIVE,      color: "text-emerald-400" },
          { label: "Failed",      value: statusCounts.FAILED,      color: statusCounts.FAILED > 0 ? "text-red-400" : "text-zinc-600" },
          { label: "Rolled Back", value: statusCounts.ROLLED_BACK, color: "text-zinc-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <p className={`text-xl font-semibold ${color}`}>{value}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-300">All Deployments</span>
          {/* Project filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
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
          <div className="py-12 text-center">
            <p className="text-sm text-zinc-600">No deployments found</p>
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
                    <tr key={d.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3">
                        {proj ? (
                          <Link href={`/projects/${proj.id}`} className="text-zinc-300 hover:text-zinc-100 font-medium transition-colors">
                            {proj.name}
                          </Link>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[10px]">{d.projectId.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-zinc-400">v{d.version}</td>
                      <td className="px-5 py-3">
                        <span className={`font-semibold ${d.color === "BLUE" ? "text-blue-400" : "text-emerald-400"}`}>
                          {d.color}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-zinc-600 max-w-[140px] truncate">{d.containerName}</td>
                      <td className="px-5 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-5 py-3 font-mono text-zinc-500">{d.port}</td>
                      <td className="px-5 py-3 text-zinc-500">{timeAgo(d.updatedAt)}</td>
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
