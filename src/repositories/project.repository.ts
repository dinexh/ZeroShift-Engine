import { Project, Prisma } from "@prisma/client";
import prisma from "../prisma/client";

export class ProjectRepository {
  async create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return prisma.project.create({ data });
  }

  async findById(id: string): Promise<Project | null> {
    return prisma.project.findUnique({ where: { id } });
  }

  async findByName(name: string): Promise<Project | null> {
    return prisma.project.findUnique({ where: { name } });
  }

  async findAll(): Promise<Project[]> {
    return prisma.project.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async update(id: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    return prisma.project.update({ where: { id }, data });
  }

  /**
   * Returns the next available base port for a new project.
   * Each project occupies 2 ports (blue = basePort, green = basePort + 1).
   * Starts at 3100 and increments by 2 for each existing project.
   */
  async getNextBasePort(startPort = 3100): Promise<number> {
    const projects = await prisma.project.findMany({ select: { basePort: true } });
    if (projects.length === 0) return startPort;
    const max = Math.max(...projects.map((p) => p.basePort));
    return max + 2;
  }

  async delete(id: string): Promise<Project> {
    // Delete child deployments first to satisfy the foreign key constraint
    await prisma.deployment.deleteMany({ where: { projectId: id } });
    return prisma.project.delete({ where: { id } });
  }
}
