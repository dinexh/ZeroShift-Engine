import { buildApp } from "./app";
import { config } from "./config/env";
import { logger } from "./utils/logger";
import prisma from "./prisma/client";
import { ReconciliationService } from "./services/reconciliation.service";

async function start(): Promise<void> {
  const app = await buildApp();

  // Graceful shutdown
  
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    // Run reconciliation before accepting requests — cleans up any crashed deploys
    const reconciliation = new ReconciliationService();
    const report = await reconciliation.reconcile();
    logger.info(report, "Startup reconciliation complete");

    const PORT = config.port || 9090;
    await app.listen({ port: PORT, host: "0.0.0.0" });
    logger.info(
      {
        port: PORT,
        dockerNetwork: config.dockerNetwork,
        nginxConfigPath: config.nginxConfigPath,
        projectsRootPath: config.projectsRootPath,
      },
      "ZeroShift Engine is running"
    );
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    await prisma.$disconnect();
    process.exit(1);
  }
}

start();
