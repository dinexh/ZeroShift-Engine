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
 * Maps hostPort on the host to containerPort inside the container.
 * Injects each key-value pair in env as -e KEY=value arguments.
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
  const envArgs = Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]);
  await execFileAsync("docker", [
    "run",
    "-d",
    "--name", name,
    "--network", network,
    "-p", `${hostPort}:${containerPort}`,
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
    // Container does not exist or inspect failed
    return false;
  }
}
