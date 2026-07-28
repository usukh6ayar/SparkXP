import * as Sentry from '@sentry/node';
import { Logger } from '@nestjs/common';

/**
 * Error reporting.
 *
 * There was no crash reporting anywhere in the project (docs/CODE_AUDIT.md
 * §M7a), which means once the app is in the store the only signal that
 * something broke is a user complaining.
 *
 * Sentry is INERT unless `SENTRY_DSN` is set, so local dev and anyone without
 * an account is unaffected — no account needed to run the project.
 *
 * Must be called before the Nest app is created: Sentry patches the runtime
 * (http, console) at init and can't retroactively instrument what already ran.
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Sample a slice of traces rather than all of them — full tracing on a
    // chatty API gets expensive fast. Tune with SENTRY_TRACES_SAMPLE_RATE.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Never ship request bodies: they carry passwords, OTP codes and JWTs.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });

  Logger.log('Sentry error reporting enabled', 'Observability');
  return true;
}

/** Report an exception if Sentry is configured; a no-op otherwise. */
export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
