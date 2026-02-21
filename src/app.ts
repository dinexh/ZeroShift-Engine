import Fastify, { FastifyInstance } from "fastify";
import { config } from "./config/env";
import { logger } from "./utils/logger";
import { AppError } from "./utils/errors";
import { deploymentRoutes } from "./routes/deployment.routes";
import { projectRoutes } from "./routes/project.routes";
import { systemRoutes } from "./routes/system.routes";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    disableRequestLogging: false,
  });

  // ── Global error handler ────────────────────────────────────────────────────
  app.setErrorHandler(async (error, _req, reply) => {
    if (error instanceof AppError) {
      logger.warn({ code: error.code, msg: error.message }, "Application error");
      return reply.code(error.statusCode).send({
        error: error.name,
        message: error.message,
        code: error.code,
      });
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.code(400).send({
        error: "ValidationError",
        message: "Request validation failed",
        details: error.validation,
      });
    }

    logger.error({ err: error }, "Unhandled error");
    return reply.code(500).send({
      error: "InternalServerError",
      message: "An unexpected error occurred",
    });
  });

  // ── Health endpoint ─────────────────────────────────────────────────────────
  app.get("/health", async (_req, reply) => {
    return reply.code(200).send({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── Routes ──────────────────────────────────────────────────────────────────
  await app.register(deploymentRoutes, { prefix: "/api/v1" });
  await app.register(projectRoutes, { prefix: "/api/v1" });
  await app.register(systemRoutes, { prefix: "/api/v1" });

  return app;
}
