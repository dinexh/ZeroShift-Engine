import { FastifyRequest, FastifyReply } from "fastify";
import { ReconciliationService } from "../services/reconciliation.service";

const reconciliationService = new ReconciliationService();
const MONIX_BASE = "http://localhost:3030/api";

const EMPTY_SERVER_STATS = {
  status: "unavailable",
  cpu_percent: 0,
  memory_percent: 0,
  disk_percent: 0,
  network_sent: 0,
  network_recv: 0,
  uptime: 0,
  load_avg: [0, 0, 0],
  process_count: 0,
  timestamp: new Date().toISOString(),
};

export async function reconcileHandler(
  _req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const report = await reconciliationService.reconcile();
  reply.code(200).send({ ok: true, report });
}

export async function getServerStatsHandler(
  _req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const res = await fetch(`${MONIX_BASE}/system-stats`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json() as Record<string, unknown>;
    reply.code(200).send({ status: "ok", ...data });
  } catch {
    reply.code(200).send(EMPTY_SERVER_STATS);
  }
}

export async function getServerDashboardHandler(
  _req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const res = await fetch(`${MONIX_BASE}/dashboard`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json() as Record<string, unknown>;
    reply.code(200).send({ status: "ok", ...data });
  } catch {
    reply.code(200).send({
      status: "unavailable",
      connections: [],
      alerts: [],
      system_stats: EMPTY_SERVER_STATS,
      traffic_summary: { total_requests: 0, unique_ips: 0, total_404s: 0, high_risk_hits: 0, suspicious_ips: [] },
    });
  }
}
