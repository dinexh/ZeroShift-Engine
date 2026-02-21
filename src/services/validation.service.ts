import axios from "axios";
import { inspectContainer } from "../utils/docker";
import { config } from "../config/env";
import { logger } from "../utils/logger";

export interface ValidationResult {
  success: boolean;
  latency: number;
  error?: string;
}

export class ValidationService {
  /**
   * Validates a deployed container by:
   * 1. Confirming the container is running via docker inspect.
   * 2. Hitting the health endpoint up to maxRetries times.
   * 3. Failing if the response time exceeds maxLatencyMs.
   */
  async validate(
    baseUrl: string,
    healthPath: string,
    containerName: string
  ): Promise<ValidationResult> {
    const healthUrl = `${baseUrl}${healthPath}`;
    const { maxRetries, retryDelayMs, healthTimeoutMs, maxLatencyMs } = config.validation;

    logger.info({ healthUrl, containerName }, "Starting validation");

    // Fast-fail if container is not running
    const running = await inspectContainer(containerName);
    if (!running) {
      return {
        success: false,
        latency: 0,
        error: `Container ${containerName} is not running`,
      };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const start = Date.now();
      try {
        const response = await axios.get(healthUrl, { timeout: healthTimeoutMs });
        const latency = Date.now() - start;

        if (response.status >= 200 && response.status < 300) {
          if (latency > maxLatencyMs) {
            const msg = `Latency ${latency}ms exceeded threshold of ${maxLatencyMs}ms`;
            logger.warn({ healthUrl, attempt, latency }, msg);
            // Treat high latency as failure and retry
          } else {
            logger.info({ healthUrl, attempt, latency }, "Validation passed");
            return { success: true, latency };
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ healthUrl, attempt, err: message }, "Validation attempt failed");
      }

      if (attempt < maxRetries) {
        await this.sleep(retryDelayMs);
      }
    }

    const error = `Health check failed after ${maxRetries} attempts`;
    logger.error({ healthUrl, containerName }, error);
    return { success: false, latency: 0, error };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
