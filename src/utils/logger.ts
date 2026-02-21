import pino from "pino";
import { config } from "../config/env";

export const logger = pino({
  level: config.logLevel,
  transport: { target: "pino-pretty", options: { colorize: true } },
});
