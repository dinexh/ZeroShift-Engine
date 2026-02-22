import { FastifyInstance } from "fastify";
import { githubWebhookHandler } from "../controllers/webhook.controller";

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post("/webhooks/:secret", {
    schema: {
      params: {
        type: "object",
        properties: { secret: { type: "string" } },
        required: ["secret"],
      },
    },
    handler: githubWebhookHandler,
  });
}
