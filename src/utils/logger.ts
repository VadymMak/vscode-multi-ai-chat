import { format } from "date-fns";

// Define the available log levels
export enum LoggerLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

// Logger configuration interface
interface LoggerConfig {
  level: LoggerLevel;
  timestampFormat: string;
}

// Default logger configuration
const defaultConfig: LoggerConfig = {
  level: LoggerLevel.INFO,
  timestampFormat: "yyyy-MM-dd HH:mm:ss",
};

// Logger class
class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  // Log a message at the specified level
  private log(level: LoggerLevel, message: string, error?: Error): void {
    if (this.shouldLog(level)) {
      const timestamp = format(new Date(), this.config.timestampFormat);
      const logMessage = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;

      switch (level) {
        case LoggerLevel.ERROR:
          console.error(logMessage, error);
          break;
        case LoggerLevel.WARN:
          console.warn(logMessage);
          break;
        case LoggerLevel.INFO:
          console.info(logMessage);
          break;
        case LoggerLevel.DEBUG:
          console.debug(logMessage);
          break;
      }
    }
  }

  // Determine if the message should be logged based on the current log level
  private shouldLog(level: LoggerLevel): boolean {
    const levels = Object.values(LoggerLevel);
    return levels.indexOf(level) <= levels.indexOf(this.config.level);
  }

  // Public methods to log messages at specific levels
  public error(message: string, error?: Error): void {
    this.log(LoggerLevel.ERROR, message, error);
  }

  public warn(message: string): void {
    this.log(LoggerLevel.WARN, message);
  }

  public info(message: string): void {
    this.log(LoggerLevel.INFO, message);
  }

  public debug(message: string): void {
    this.log(LoggerLevel.DEBUG, message);
  }
}

// Singleton instance of the Logger
const logger = new Logger();

// Export the logger instance for use in other modules
export default logger;
