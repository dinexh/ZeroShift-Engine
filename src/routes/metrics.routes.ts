import { FastifyInstance } from "fastify";
import {
  getProjectMetricsHandler,
  getProjectLogsHandler,
} from "../controllers/metrics.controller";

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/projects/:id/metrics", { handler: getProjectMetricsHandler });
  app.get("/projects/:id/logs", { handler: getProjectLogsHandler });
}
