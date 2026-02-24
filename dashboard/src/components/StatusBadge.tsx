import type { DeploymentStatus, DeploymentColor } from "@/lib/api";

const STATUS_STYLES: Record<DeploymentStatus, string> = {
  ACTIVE:      "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
  DEPLOYING:   "bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse",
  FAILED:      "bg-red-500/15 text-red-400 border border-red-500/30",
  ROLLED_BACK: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30",
  PENDING:     "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30",
};

const COLOR_STYLES: Record<DeploymentColor, string> = {
  BLUE:  "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  GREEN: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
};

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? ""}`}>
      {status}
    </span>
  );
}

export function ColorBadge({ color }: { color: DeploymentColor }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${COLOR_STYLES[color] ?? ""}`}>
      {color}
    </span>
  );
}

export function RunningDot({ running }: { running: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="relative flex h-2 w-2">
        {running && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${running ? "bg-indigo-400" : "bg-red-500"}`} />
      </span>
      <span className={running ? "text-indigo-400" : "text-red-400"}>
        {running ? "Running" : "Stopped"}
      </span>
    </span>
  );
}
