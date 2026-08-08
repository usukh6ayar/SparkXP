import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

jest.mock('../observability/sentry', () => ({ captureException: jest.fn() }));

/**
 * The regression this guards: the filter rebuilt the response from
 * `message`/`error` only, so a `code` thrown alongside them never reached the
 * client. `VOICE_LIMIT` shipped that way — the app's `err.code === 'VOICE_LIMIT'`
 * branch was dead code and nobody noticed, because the fallback error text
 * looked plausible.
 */
describe('HttpExceptionFilter', () => {
  const run = (exception: unknown) => {
    let status = -1;
    let body: Record<string, unknown> = {};
    const res = {
      status(code: number) {
        status = code;
        return { json: (payload: Record<string, unknown>) => { body = payload; } };
      },
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ url: '/api/test', method: 'POST' }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(exception, host);
    return { status, body };
  };

  it('forwards extra fields (code, email) alongside the envelope', () => {
    const { status, body } = run(
      new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Имэйлээ баталгаажуулна уу.',
        email: 'a@b.mn',
      }),
    );

    expect(status).toBe(HttpStatus.FORBIDDEN);
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(body.email).toBe('a@b.mn');
    expect(body.message).toBe('Имэйлээ баталгаажуулна уу.');
  });

  it('keeps the AI limit code that used to be dropped', () => {
    const { body } = run(
      new ForbiddenException({ code: 'VOICE_LIMIT', message: 'хязгаар' }),
    );
    expect(body.code).toBe('VOICE_LIMIT');
  });

  it('never lets an extra field overwrite the envelope', () => {
    // A handler that throws `{ statusCode: 200 }` must not be able to tell the
    // client the request succeeded — the envelope is written last, so it wins.
    const { status, body } = run(
      new HttpException(
        { statusCode: 200, path: '/spoofed', message: 'nope' },
        HttpStatus.BAD_REQUEST,
      ),
    );
    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.path).toBe('/api/test');
  });

  it('leaves a plain string exception shape unchanged', () => {
    const { status, body } = run(new UnauthorizedException('буруу'));
    expect(status).toBe(HttpStatus.UNAUTHORIZED);
    expect(body.message).toBe('буруу');
    expect(body.code).toBeUndefined();
  });

  it('keeps class-validator message arrays intact', () => {
    const { body } = run(new BadRequestException(['a must be a string']));
    expect(body.message).toEqual(['a must be a string']);
  });

  it('hides details of an unexpected (non-HTTP) error', () => {
    const { status, body } = run(new Error('DB password is hunter2'));
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});
