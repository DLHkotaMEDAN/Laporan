/**
 * Centralized logging utility for the application
 * Replaces console.log/error/warn/debug with structured logging
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Helper to safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
}

class Logger {
  private isDev = import.meta.env.DEV;

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    if (this.isDev) {
      console.error(message, error, context);
    }
    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // this.trackError(message, error, context);
  }

  warn(message: string, data?: unknown, context?: Record<string, unknown>) {
    if (this.isDev) {
      console.warn(message, data, context);
    }
  }

  info(message: string, data?: unknown, context?: Record<string, unknown>) {
    if (this.isDev) {
      console.log(message, data, context);
    }
  }

  debug(message: string, data?: unknown, context?: Record<string, unknown>) {
    if (this.isDev) {
      console.debug(message, data, context);
    }
  }

  private trackError(message: string, error?: unknown, context?: Record<string, unknown>) {
    // Integration with error tracking service would go here
    // Example: Sentry.captureException(error, { extra: { message, context } });
  }
}

export const logger = new Logger();
