import { LogLevel } from "../types/index";

// Define log levels
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Current log level, can be configured
let currentLogLevel: LogLevel = LogLevel.INFO;

// Utility function to log messages based on the current log level
function log(level: LogLevel, message: string, ...optionalParams: any[]): void {
  if (LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel]) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, ...optionalParams);
  }
}

// Public API for logging
const logger = {
  setLogLevel: (level: LogLevel) => {
    if (LOG_LEVELS[level] !== undefined) {
      currentLogLevel = level;
    } else {
      console.warn(`Invalid log level: ${level}`);
    }
  },
  debug: (message: string, ...optionalParams: any[]) =>
    log(LogLevel.DEBUG, message, ...optionalParams),
  info: (message: string, ...optionalParams: any[]) =>
    log(LogLevel.INFO, message, ...optionalParams),
  warn: (message: string, ...optionalParams: any[]) =>
    log(LogLevel.WARN, message, ...optionalParams),
  error: (message: string, ...optionalParams: any[]) =>
    log(LogLevel.ERROR, message, ...optionalParams),
};

export default logger;
