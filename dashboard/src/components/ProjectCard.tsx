"use client";
import Link from "next/link";
import type { Project, Deployment } from "@/lib/api";
import { StatusBadge, ColorBadge, RunningDot } from "./StatusBadge";

interface Props {
  project: Project;
  activeDeployment: Deployment | undefined;
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

export function ProjectCard({ project, activeDeployment }: Props) {
  const isRunning = activeDeployment?.status === "ACTIVE";

  return (
    <Link href={`/projects/${project.id}/`}>
      <div className="group bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-all cursor-pointer h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-zinc-100 group-hover:text-white transition-colors truncate">
              {project.name}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">
              {project.repoUrl}
            </p>
          </div>
          {activeDeployment && (
            <div className="ml-2 shrink-0">
              <ColorBadge color={activeDeployment.color} />
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Status</span>
            {activeDeployment ? (
              <StatusBadge status={activeDeployment.status} />
            ) : (
              <span className="text-xs text-zinc-600">No deployments</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Container</span>
            <RunningDot running={isRunning} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Last deploy</span>
            <span className="text-xs text-zinc-400">
              {activeDeployment ? timeAgo(activeDeployment.updatedAt) : "—"}
            </span>
          </div>

          {activeDeployment && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Version</span>
              <span className="text-xs text-zinc-400 font-mono">
                v{activeDeployment.version}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
