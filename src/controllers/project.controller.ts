import { FastifyRequest, FastifyReply } from "fastify";
import path from "path";
import { ProjectRepository } from "../repositories/project.repository";
import { RollbackService } from "../services/rollback.service";
import { config } from "../config/env";
import { validateEnvObject } from "../utils/env";

const projectRepo = new ProjectRepository();
const rollbackService = new RollbackService();

interface CreateProjectBody {
  name: string;
  repoUrl: string;
  branch?: string;
  appPort: number;
  healthPath?: string;
  basePort: number;
  env?: Record<string, string>;
}

interface ProjectParams {
  id: string;
}

interface UpdateEnvBody {
  env: Record<string, string>;
}

export async function createProjectHandler(
  req: FastifyRequest<{ Body: CreateProjectBody }>,
  reply: FastifyReply
): Promise<void> {
  const { name, repoUrl, branch = "main", appPort, healthPath = "/health", basePort, env = {} } = req.body;

  const envError = validateEnvObject(env);
  if (envError) {
    return reply.code(400).send({ error: "ValidationError", message: envError });
  }

  // localPath is auto-computed — set a placeholder before we have the id.
  // We create the project then update localPath with the generated id.
  const project = await projectRepo.create({
    name,
    repoUrl,
    branch,
    appPort,
    healthPath,
    basePort,
    localPath: "", // temporary; patched below
    env,
  });

  // Patch localPath now that we have the id
  const localPath = path.join(config.projectsRootPath, project.id);
  const updated = await projectRepo.update(project.id, { localPath });

  reply.code(201).send({ project: updated });
}

export async function listProjectsHandler(
  _req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const projects = await projectRepo.findAll();
  reply.code(200).send({ projects });
}

export async function getProjectHandler(
  req: FastifyRequest<{ Params: ProjectParams }>,
  reply: FastifyReply
): Promise<void> {
  const project = await projectRepo.findById(req.params.id);
  if (!project) {
    return reply.code(404).send({ error: "NotFound", message: "Project not found" });
  }
  reply.code(200).send({ project });
}

export async function deleteProjectHandler(
  req: FastifyRequest<{ Params: ProjectParams }>,
  reply: FastifyReply
): Promise<void> {
  await projectRepo.delete(req.params.id);
  reply.code(204).send();
}

export async function rollbackProjectHandler(
  req: FastifyRequest<{ Params: ProjectParams }>,
  reply: FastifyReply
): Promise<void> {
  const result = await rollbackService.rollback(req.params.id);
  reply.code(200).send(result);
}

export async function updateProjectEnvHandler(
  req: FastifyRequest<{ Params: ProjectParams; Body: UpdateEnvBody }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = req.params;
  const { env } = req.body;

  const envError = validateEnvObject(env);
  if (envError) {
    return reply.code(400).send({ error: "ValidationError", message: envError });
  }

  const project = await projectRepo.findById(id);
  if (!project) {
    return reply.code(404).send({ error: "NotFound", message: "Project not found" });
  }

  const updated = await projectRepo.update(id, { env });
  reply.code(200).send({ project: updated });
}
