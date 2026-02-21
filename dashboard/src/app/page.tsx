"use client";
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { api, type Project, type Deployment } from "@/lib/api";
import { ProjectCard } from "@/components/ProjectCard";
import { CreateProjectModal } from "@/components/CreateProjectModal";

export default function OverviewPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [deploymentMap, setDeploymentMap] = useState<Record<string, Deployment>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-zinc-100">Projects</h1>
          <div className="h-8 w-28 bg-zinc-800 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse"
            >
              <div className="h-4 bg-zinc-800 rounded w-2/3 mb-2" />
              <div className="h-3 bg-zinc-800 rounded w-full mb-6" />
              <div className="space-y-2">
                <div className="h-3 bg-zinc-800 rounded" />
                <div className="h-3 bg-zinc-800 rounded" />
                <div className="h-3 bg-zinc-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-100">Projects</h1>
          <span className="text-xs text-zinc-600">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 text-sm rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors"
        >
          + New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div
          className="text-center py-20 border border-dashed border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-600 transition-colors"
          onClick={() => setCreateOpen(true)}
        >
          <p className="text-sm text-zinc-500">No projects yet</p>
          <p className="text-xs text-zinc-600 mt-1">Click to create your first project</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              activeDeployment={deploymentMap[p.id]}
            />
          ))}
        </div>
      )}

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchData}
      />
    </div>
  );
}
