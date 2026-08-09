import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { captureException } from '../observability/sentry';

/** Keys the normalised envelope owns; anything else in the body is passed on. */
const ENVELOPE_KEYS = new Set(['statusCode', 'error', 'message', 'path', 'timestamp']);

/**
 * Global filter that normalises all HTTP errors into:
 *   { statusCode, error, message, path, timestamp, ...extra }
 *
 * This gives every client a predictable error shape regardless of which
 * NestJS exception was thrown.
 *
 * ⚠️ `...extra` matters. Throwing `new ForbiddenException({ code: 'X', … })` is
 * how the backend tells the app *which* refusal this is, but this filter used
 * to rebuild the body from `message`/`error` alone and **silently dropped every
 * other field**. `VOICE_LIMIT` had been shipping like that: the app's
 * `err.code === 'VOICE_LIMIT'` branch in `chat.tsx` could never once have run,
 * because `code` never survived the trip. Nothing failed loudly — the app just
 * fell through to the generic error text.
 *
 * So extra keys from an HttpException body are now forwarded as-is. Only
 * `HttpException` bodies are spread — an unexpected error has no body here, and
 * its details stay hidden from the client (see the `else` branch).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? message;
        error = (b.error as string) ?? exception.name;
        extra = Object.fromEntries(
          Object.entries(b).filter(([k]) => !ENVELOPE_KEYS.has(k)),
        );
      }
    } else {
      // Unexpected errors — log for investigation, hide details from client.
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // Only genuinely unexpected errors reach Sentry. Deliberate 4xx
      // (HttpException) are normal traffic and would drown the signal.
      captureException(exception, {
        method: request.method,
        url: request.url,
        userId: (request as Request & { user?: { id?: string } }).user?.id,
      });
    }

    response.status(status).json({
      ...extra,
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
