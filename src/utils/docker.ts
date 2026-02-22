import { execFileAsync } from "./exec";
import { logger } from "./logger";

/**
 * Builds a Docker image from a local build context.
 */
export async function buildImage(imageTag: string, contextPath: string): Promise<void> {
  logger.info({ imageTag, contextPath }, "Building Docker image");
  await execFileAsync("docker", ["build", "-t", imageTag, contextPath]);
}

/**
 * Starts a Docker container in detached mode.
 *
 * Bridge/custom network: maps hostPort → containerPort via -p, adds host.docker.internal.
 * Host network: shares host network stack (bypasses Docker NAT — fixes cloud DB connectivity).
 *   - -p and --add-host are invalid/ignored with --network host
 *   - PORT=<hostPort> is injected so the app listens on the right port for blue-green
 */
export async function runContainer(
  name: string,
  imageTag: string,
  hostPort: number,
  containerPort: number,
  network: string,
  env: Record<string, string> = {}
): Promise<void> {
  logger.info({ name, imageTag, hostPort, containerPort, network }, "Starting Docker container");
  const isHostNetwork = network === "host";

  // With host networking, inject PORT so the app listens on the correct blue/green port.
  // User-supplied env can still override PORT if they need a fixed value.
  const effectiveEnv = isHostNetwork && !("PORT" in env)
    ? { PORT: String(hostPort), ...env }
    : env;

  const envArgs = Object.entries(effectiveEnv).flatMap(([key, value]) => ["-e", `${key}=${value}`]);

  const networkArgs: string[] = isHostNetwork
    ? ["--network", "host"]
    : [
        "--network", network,
        "--add-host=host.docker.internal:host-gateway",
        "-p", `${hostPort}:${containerPort}`,
      ];

  await execFileAsync("docker", [
    "run",
    "-d",
    "--name", name,
    ...networkArgs,
    "--restart", "unless-stopped",
    ...envArgs,
    imageTag,
  ]);
}

/**
 * Gracefully stops a running container.
 */
export async function stopContainer(name: string): Promise<void> {
  logger.info({ name }, "Stopping Docker container");
  await execFileAsync("docker", ["stop", name]);
}

/**
 * Force-removes a container (stopped or running).
 */
export async function removeContainer(name: string): Promise<void> {
  logger.info({ name }, "Removing Docker container");
  await execFileAsync("docker", ["rm", "-f", name]);
}

/**
 * Returns true if the container exists and is in a running state.
 */
export async function inspectContainer(name: string): Promise<boolean> {
  logger.info({ name }, "Inspecting Docker container");
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "-f",
      "{{.State.Running}}",
      name,
    ]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

/**
 * Returns the number of times Docker has restarted this container.
 * A non-zero value means the app inside is crash-looping.
 */
export async function getContainerRestartCount(name: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect", "-f", "{{.RestartCount}}", name,
    ]);
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

export interface RawContainerStats {
  CPUPerc: string;
  MemUsage: string;
  MemPerc: string;
  NetIO: string;
  BlockIO: string;
  PIDs: string;
  Name: string;
}

/**
 * Returns a single live stats snapshot for a container.
 * Returns null if the container is not running or does not exist.
 */
export async function getContainerStats(name: string): Promise<RawContainerStats | null> {
  logger.debug({ name }, "Fetching container stats");
  try {
    const { stdout } = await execFileAsync("docker", [
      "stats", "--no-stream", "--format", "{{json .}}", name,
    ]);
    const line = stdout.trim();
    if (!line) return null;
    return JSON.parse(line) as RawContainerStats;
  } catch {
    return null;
  }
}

/**
 * Returns the last N log lines from a container (stdout + stderr combined).
 * Returns an empty array if the container does not exist or has no logs.
 */
export async function getContainerLogs(name: string, tail = 200): Promise<string[]> {
  logger.debug({ name, tail }, "Fetching container logs");
  try {
    const { stdout, stderr } = await execFileAsync("docker", [
      "logs", "--tail", String(tail), "--timestamps", name,
    ]);
    return (stdout + "\n" + stderr)
      .split("\n")
      .filter((l) => l.trim() !== "")
      .slice(-tail);
  } catch {
    return [];
  }
}
