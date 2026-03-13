import { Badge } from "@/components/ui/badge";
import type { DeploymentStatus, DeploymentColor } from "@/lib/api";

const STATUS_VARIANT: Record<DeploymentStatus, "active" | "deploying" | "failed" | "rolled_back" | "pending"> = {
  ACTIVE:      "active",
  DEPLOYING:   "deploying",
  FAILED:      "failed",
  ROLLED_BACK: "rolled_back",
  PENDING:     "pending",
};

const COLOR_VARIANT: Record<DeploymentColor, "blue" | "green"> = {
  BLUE:  "blue",
  GREEN: "green",
};

const STATUS_LABEL: Record<DeploymentStatus, string> = {
  ACTIVE:      "Active",
  DEPLOYING:   "Deploying",
  FAILED:      "Failed",
  ROLLED_BACK: "Rolled Back",
  PENDING:     "Pending",
};

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function ColorBadge({ color }: { color: DeploymentColor }) {
  return (
    <Badge variant={COLOR_VARIANT[color] ?? "outline"}>
      {color}
    </Badge>
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
