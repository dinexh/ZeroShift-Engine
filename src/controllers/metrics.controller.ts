import { FastifyRequest, FastifyReply } from "fastify";
import { DeploymentRepository } from "../repositories/deployment.repository";
import { ProjectRepository } from "../repositories/project.repository";
import { getContainerStats, getContainerLogs } from "../utils/docker";
import { logger } from "../utils/logger";

const deploymentRepo = new DeploymentRepository();
const projectRepo = new ProjectRepository();

interface ProjectParams {
  id: string;
}

function parsePercent(s: string): number {
  return parseFloat(s.replace("%", "")) || 0;
}

function parseMemoryBytes(s: string): number {
  const match = s.trim().match(/^([\d.]+)\s*([A-Za-z]+)?$/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2] ?? "B";
  const units: Record<string, number> = {
    B: 1,
    KB: 1_000,       KiB: 1_024,
    MB: 1_000_000,   MiB: 1_048_576,
    GB: 1_000_000_000, GiB: 1_073_741_824,
    TB: 1_000_000_000_000, TiB: 1_099_511_627_776,
  };
  return value * (units[unit] ?? 1);
}

const EMPTY_METRICS = {
  running: false,
  cpu: 0,
  memoryUsed: 0,
  memoryLimit: 0,
  memoryPercent: 0,
};

export async function getProjectMetricsHandler(
  req: FastifyRequest<{ Params: ProjectParams }>,
  reply: FastifyReply
): Promise<void> {
  const project = await projectRepo.findById(req.params.id);
  if (!project) {
    return reply.code(404).send({ error: "NotFound", message: "Project not found" });
  }

  const active = await deploymentRepo.findActiveForProject(req.params.id);
  if (!active) {
    return reply.code(200).send({ ...EMPTY_METRICS, timestamp: new Date().toISOString() });
  }

  const stats = await getContainerStats(active.containerName);
  if (!stats) {
    logger.warn({ containerName: active.containerName }, "Metrics: docker stats returned null");
    return reply.code(200).send({ ...EMPTY_METRICS, timestamp: new Date().toISOString() });
  }

  const [usedStr, limitStr] = stats.MemUsage.split(" / ");
  const memoryUsed = parseMemoryBytes(usedStr ?? "0");
  const memoryLimit = parseMemoryBytes(limitStr ?? "0");

  reply.code(200).send({
    running: true,
    cpu: parsePercent(stats.CPUPerc),
    memoryUsed,
    memoryLimit,
    memoryPercent: parsePercent(stats.MemPerc),
    timestamp: new Date().toISOString(),
  });
}

export async function getProjectLogsHandler(
  req: FastifyRequest<{ Params: ProjectParams }>,
  reply: FastifyReply
): Promise<void> {
  const project = await projectRepo.findById(req.params.id);
  if (!project) {
    return reply.code(404).send({ error: "NotFound", message: "Project not found" });
  }

  // Prefer the active deployment; fall back to the most recent one of any
  // status so failed container logs are still visible in the dashboard.
  const active = await deploymentRepo.findActiveForProject(req.params.id);
  const target = active ?? (await deploymentRepo.findAllForProject(req.params.id))[0] ?? null;

  if (!target) {
    return reply.code(200).send({ lines: [], containerName: null });
  }

  const lines = await getContainerLogs(target.containerName, 200);
  reply.code(200).send({ lines, containerName: target.containerName });
}
