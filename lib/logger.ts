type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private format(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  info(message: string, data?: unknown): void {
    const entry = this.format("info", message, data);
    console.log(`[${entry.timestamp}] INFO: ${entry.message}`, data ?? "");
  }

  warn(message: string, data?: unknown): void {
    const entry = this.format("warn", message, data);
    console.warn(`[${entry.timestamp}] WARN: ${entry.message}`, data ?? "");
  }

  error(message: string, data?: unknown): void {
    const entry = this.format("error", message, data);
    console.error(`[${entry.timestamp}] ERROR: ${entry.message}`, data ?? "");
  }

  debug(message: string, data?: unknown): void {
    if (this.isDevelopment) {
      const entry = this.format("debug", message, data);
      console.debug(`[${entry.timestamp}] DEBUG: ${entry.message}`, data ?? "");
    }
  }
}

export const logger = new Logger();
