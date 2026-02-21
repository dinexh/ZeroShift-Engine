import { Deployment, DeploymentStatus, Prisma, Project } from "@prisma/client";
import prisma from "../prisma/client";

export class DeploymentRepository {
  async create(data: Prisma.DeploymentCreateInput): Promise<Deployment> {
    return prisma.deployment.create({ data });
  }

  async findById(id: string): Promise<Deployment | null> {
    return prisma.deployment.findUnique({ where: { id } });
  }

  // ── Project-scoped queries ─────────────────────────────────────────────────

  async findActiveForProject(projectId: string): Promise<Deployment | null> {
    return prisma.deployment.findFirst({
      where: { projectId, status: DeploymentStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Finds the most recently ROLLED_BACK deployment for a project whose version
   * is strictly lower than the current active version. This ensures correct
   * rollback targets even after multiple sequential deploy/rollback cycles.
   */
  async findPreviousForProject(
    projectId: string,
    currentVersion: number
  ): Promise<Deployment | null> {
    return prisma.deployment.findFirst({
      where: {
        projectId,
        status: DeploymentStatus.ROLLED_BACK,
        version: { lt: currentVersion },
      },
      orderBy: { version: "desc" },
    });
  }

  async findAllForProject(projectId: string): Promise<Deployment[]> {
    return prisma.deployment.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getNextVersionForProject(projectId: string): Promise<number> {
    const latest = await prisma.deployment.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  // ── Reconciliation queries ─────────────────────────────────────────────────

  /** All deployments stuck mid-deploy — used by crash recovery on startup. */
  async findAllDeploying(): Promise<Deployment[]> {
    return prisma.deployment.findMany({ where: { status: DeploymentStatus.DEPLOYING } });
  }

  /** All ACTIVE deployments with their project — used to audit container health. */
  async findAllActiveWithProjects(): Promise<(Deployment & { project: Project })[]> {
    return prisma.deployment.findMany({
      where: { status: DeploymentStatus.ACTIVE },
      include: { project: true },
    }) as Promise<(Deployment & { project: Project })[]>;
  }

  // ── Global queries (kept for status endpoint) ──────────────────────────────

  async findAll(): Promise<Deployment[]> {
    return prisma.deployment.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async updateStatus(
    id: string,
    status: DeploymentStatus,
    errorMessage?: string
  ): Promise<Deployment> {
    return prisma.deployment.update({
      where: { id },
      data: { status, ...(errorMessage !== undefined ? { errorMessage } : {}) },
    });
  }
}
