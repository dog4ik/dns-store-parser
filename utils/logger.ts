import { pino } from "pino";

export default function initLogger(level: pino.Level) {
  let logger = pino();
  logger.level = level;
  return logger;
}
