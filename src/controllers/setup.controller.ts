import { FastifyRequest, FastifyReply } from "fastify";
import { isSetupComplete, applySetup, SetupPayload } from "../services/setup.service";

export async function setupStatusHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.code(200).send({ configured: isSetupComplete() });
}

export async function setupApplyHandler(
  req: FastifyRequest<{ Body: SetupPayload }>,
  reply: FastifyReply
) {
  const { domain, databaseUrl, geminiApiKey } = req.body;

  if (!domain || !databaseUrl) {
    return reply.code(400).send({ error: "domain and databaseUrl are required" });
  }

  const steps = await applySetup({ domain, databaseUrl, geminiApiKey });
  const allOk = steps.every((s) => s.ok);

  if (allOk) {
    // Restart so the engine re-reads .env and boots in normal mode.
    // PM2 (autorestart: true) will bring it back up in ~3s.
    setTimeout(() => process.exit(0), 500);
  }

  return reply.code(allOk ? 200 : 207).send({ ok: allOk, steps });
}
