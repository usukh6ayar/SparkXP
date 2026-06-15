import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Catches every unhandled error and returns one consistent JSON shape:
 *
 *   { statusCode, error, message, path, timestamp }
 *
 * - HttpExceptions (incl. validation 400s, 401/403/404) keep their status and
 *   message.
 * - Anything else becomes a 500 and is logged (message hidden from the client).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Дотоод серверийн алдаа';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        // Nest's default error body: { statusCode, message, error }
        const body = res as { message?: string | string[]; error?: string };
        message = body.message ?? message;
        error = body.error ?? exception.name;
      }
    } else if (exception instanceof Error) {
      // Unexpected error — log the stack, but don't leak details to the client.
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
