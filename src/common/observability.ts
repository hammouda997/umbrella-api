import { Logger } from '@nestjs/common';

const isProd = process.env.NODE_ENV === 'production';

/** Minimal JSON-ish structured logs for production hosts. */
export function configureProcessLogging() {
  if (!isProd) return;
  const base = new Logger('Process');
  process.on('unhandledRejection', (reason) => {
    base.error(`unhandledRejection ${String(reason)}`);
  });
  process.on('uncaughtException', (err) => {
    base.error(`uncaughtException ${err.message}`, err.stack);
  });
}

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: isProd ? 0.1 : 1,
    });
    new Logger('Sentry').log('Sentry initialized');
  } catch (error) {
    new Logger('Sentry').warn(`Sentry init skipped: ${String(error)}`);
  }
}
