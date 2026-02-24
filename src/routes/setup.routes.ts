import { FastifyInstance } from "fastify";
import { setupStatusHandler, setupApplyHandler } from "../controllers/setup.controller";

export async function setupRoutes(app: FastifyInstance): Promise<void> {
  app.get("/setup/status", { schema: {} }, setupStatusHandler);

  app.post(
    "/setup/apply",
    {
      schema: {
        body: {
          type: "object",
          required: ["domain", "databaseUrl"],
          properties: {
            domain: { type: "string", minLength: 1 },
            databaseUrl: { type: "string", minLength: 1 },
            geminiApiKey: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    setupApplyHandler
  );
}
