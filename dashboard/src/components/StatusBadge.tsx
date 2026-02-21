import type { DeploymentStatus, DeploymentColor } from "@/lib/api";

const STATUS_STYLES: Record<DeploymentStatus, string> = {
  ACTIVE:
    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  DEPLOYING:
    "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 animate-pulse",
  FAILED:
    "bg-red-500/15 text-red-400 border border-red-500/30",
  ROLLED_BACK:
    "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30",
  PENDING:
    "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30",
};

const COLOR_STYLES: Record<DeploymentColor, string> = {
  BLUE:  "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  GREEN: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

export function ColorBadge({ color }: { color: DeploymentColor }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${COLOR_STYLES[color] ?? ""}`}
    >
      {color}
    </span>
  );
}

export function RunningDot({ running }: { running: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span
        className={`w-2 h-2 rounded-full ${
          running ? "bg-emerald-400" : "bg-red-500"
        }`}
      />
      <span className={running ? "text-emerald-400" : "text-red-400"}>
        {running ? "Running" : "Stopped"}
      </span>
    </span>
  );
}
