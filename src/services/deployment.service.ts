import { Deployment, DeploymentColor, DeploymentStatus } from "@prisma/client";
import { config } from "../config/env";
import { parseProjectEnv } from "../utils/env";
import { DeploymentRepository } from "../repositories/deployment.repository";
import { ProjectRepository } from "../repositories/project.repository";
import { buildImage, runContainer, stopContainer, removeContainer } from "../utils/docker";
import { ensureDockerfile } from "../utils/dockerfile";
import { logger } from "../utils/logger";
import { ConflictError, DeploymentError, NotFoundError } from "../utils/errors";
import { ValidationService } from "./validation.service";
import { TrafficService } from "./traffic.service";
import { GitService } from "./git.service";

export interface DeployOptions {
  projectId: string;
}

export interface DeployResult {
  deployment: Deployment;
  message: string;
}

export class DeploymentService {
  // In-memory lock per project — prevents concurrent deploys on the same project
  private static readonly locks = new Map<string, boolean>();

  private readonly repo: DeploymentRepository;
  private readonly projectRepo: ProjectRepository;
  private readonly validation: ValidationService;
  private readonly traffic: TrafficService;
  private readonly git: GitService;

  constructor() {
    this.repo = new DeploymentRepository();
    this.projectRepo = new ProjectRepository();
    this.validation = new ValidationService();
    this.traffic = new TrafficService();
    this.git = new GitService();
  }

  /**
   * Full blue-green deployment pipeline:
   * 1. Acquire per-project lock
   * 2. Fetch project config
   * 3. Clone/pull source via Git
   * 4. Build Docker image from source
   * 5. Determine color (BLUE/GREEN) and port
   * 6. Start new container
   * 7. Validate health
   * 8. Switch Nginx traffic
   * 9. Mark new ACTIVE, retire old
   * 10. Release lock (always — via finally)
   */
  async deploy(opts: DeployOptions): Promise<DeployResult> {
    const { projectId } = opts;

    if (!this.acquireLock(projectId)) {
      throw new ConflictError(`Deployment already in progress for project ${projectId}`);
    }

    let deploymentId: string | undefined;

    try {
      // ── Fetch project ──────────────────────────────────────────────────────
      const project = await this.projectRepo.findById(projectId);
      if (!project) {
        throw new NotFoundError(`Project ${projectId}`);
      }

      logger.info({ projectId, name: project.name }, "Starting deployment pipeline");

      // ── Step 1: Prepare source ─────────────────────────────────────────────
      logger.info({ projectId, step: 1 }, "Preparing source code");
      await this.git.prepareSource(project);
      const buildContextPath = this.git.buildContextPath(project);
      await ensureDockerfile(buildContextPath, project.appPort);

      // ── Step 2: Determine color and port ───────────────────────────────────
      const activeDeployment = await this.repo.findActiveForProject(projectId);
      const newColor =
        activeDeployment?.color === DeploymentColor.BLUE
          ? DeploymentColor.GREEN
          : DeploymentColor.BLUE;
      const hostPort =
        newColor === DeploymentColor.BLUE ? project.basePort : project.basePort + 1;
      const containerName = `${project.name}-${newColor.toLowerCase()}`;
      const imageTag = `zeroshift-${project.name}:${Date.now()}`;
      const version = await this.repo.getNextVersionForProject(projectId);

      logger.info(
        { projectId, step: 2, newColor, hostPort, containerName, imageTag },
        "Determined deployment target"
      );

      // ── Step 3: Create DEPLOYING record ───────────────────────────────────
      const deployment = await this.repo.create({
        version,
        imageTag,
        containerName,
        port: hostPort,
        color: newColor,
        status: DeploymentStatus.DEPLOYING,
        project: { connect: { id: projectId } },
      });
      deploymentId = deployment.id;

      // ── Step 4: Build image ────────────────────────────────────────────────
      logger.info({ projectId, step: 4, imageTag, buildContextPath }, "Building Docker image");
      await buildImage(imageTag, buildContextPath);

      // ── Step 5: Start container ────────────────────────────────────────────
      logger.info({ projectId, step: 5, containerName, hostPort }, "Starting container");
      const projectEnv = parseProjectEnv(project.env);
      const envKeys = Object.keys(projectEnv);
      if (envKeys.length > 0) {
        logger.info({ projectId, envKeys }, "Injecting env keys");
      }
      await runContainer(
        containerName,
        imageTag,
        hostPort,
        project.appPort,
        config.dockerNetwork,
        projectEnv
      );

      // ── Step 6: Validate ───────────────────────────────────────────────────
      logger.info({ projectId, step: 6 }, "Validating new container");
      const result = await this.validation.validate(
        `http://localhost:${hostPort}`,
        project.healthPath,
        containerName
      );

      if (!result.success) {
        const errMsg = result.error ?? "Health check failed";
        logger.error({ projectId, error: errMsg }, "Validation failed");
        await this.cleanupFailedContainer(containerName, deployment.id, errMsg);
        throw new DeploymentError(errMsg);
      }

      // ── Step 7: Switch traffic ─────────────────────────────────────────────
      logger.info({ projectId, step: 7, hostPort }, "Switching traffic");
      await this.traffic.switchTrafficTo(hostPort);

      // ── Step 8: Activate new, retire old ──────────────────────────────────
      await this.repo.updateStatus(deployment.id, DeploymentStatus.ACTIVE);

      if (activeDeployment) {
        logger.info(
          { projectId, step: 8, oldContainer: activeDeployment.containerName },
          "Stopping old container"
        );
        await stopContainer(activeDeployment.containerName).catch((err) => {
          logger.warn({ err, containerName: activeDeployment.containerName }, "Failed to stop old container");
        });
        await removeContainer(activeDeployment.containerName).catch((err) => {
          logger.warn({ err, containerName: activeDeployment.containerName }, "Failed to remove old container");
        });
        await this.repo.updateStatus(activeDeployment.id, DeploymentStatus.ROLLED_BACK);
      }

      logger.info(
        { projectId, deploymentId: deployment.id, containerName, latency: result.latency },
        "Deployment successful"
      );

      return {
        deployment: { ...deployment, status: DeploymentStatus.ACTIVE },
        message: `Deployment successful — ${containerName} is live on port ${hostPort}`,
      };
    } catch (err) {
      // Mark FAILED with the error message so the dashboard can display it
      if (deploymentId) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await this.repo
          .updateStatus(deploymentId, DeploymentStatus.FAILED, errMsg)
          .catch(() => null);
      }
      throw err;
    } finally {
      this.releaseLock(projectId);
    }
  }

  async getActiveDeployment(projectId?: string): Promise<Deployment | null> {
    if (projectId) {
      return this.repo.findActiveForProject(projectId);
    }
    return this.repo.findAll().then((all) => all.find((d) => d.status === DeploymentStatus.ACTIVE) ?? null);
  }

  async getAllDeployments(projectId?: string): Promise<Deployment[]> {
    if (projectId) {
      return this.repo.findAllForProject(projectId);
    }
    return this.repo.findAll();
  }

  private async cleanupFailedContainer(
    containerName: string,
    deploymentId: string,
    errorMessage?: string
  ): Promise<void> {
    await stopContainer(containerName).catch(() => null);
    await removeContainer(containerName).catch(() => null);
    await this.repo
      .updateStatus(deploymentId, DeploymentStatus.FAILED, errorMessage)
      .catch(() => null);
  }

  private acquireLock(projectId: string): boolean {
    if (DeploymentService.locks.get(projectId)) {
      logger.warn({ projectId }, "Deploy lock already held — rejecting concurrent deploy");
      return false;
    }
    DeploymentService.locks.set(projectId, true);
    logger.info({ projectId }, "Deploy lock acquired");
    return true;
  }

  private releaseLock(projectId: string): void {
    DeploymentService.locks.delete(projectId);
    logger.info({ projectId }, "Deploy lock released");
  }
}
