import type { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

/**
 * The boot guard is the point of this file.
 *
 * Registration emails a 6-digit code and cannot complete without it. Before the
 * guard existed, a production deploy with no mail provider looked completely
 * healthy — it just logged every OTP to the server console while each signup
 * silently dead-ended. Failing to boot is the only behaviour that surfaces the
 * mistake before real users hit it.
 */
describe('MailService — provider configuration guard', () => {
  const serviceWith = (env: Record<string, string | undefined>) =>
    new MailService({ get: (key: string) => env[key] } as unknown as ConfigService);

  it('refuses to boot in production with no provider configured', () => {
    expect(() => serviceWith({ NODE_ENV: 'production' }).onModuleInit()).toThrow(
      /no email provider configured/i,
    );
  });

  it.each([
    ['Resend', { NODE_ENV: 'production', RESEND_API_KEY: 're_123' }],
    ['SMTP', { NODE_ENV: 'production', SMTP_HOST: 'smtp.gmail.com' }],
  ])('boots in production when %s is configured', (_label, env) => {
    expect(() => serviceWith(env).onModuleInit()).not.toThrow();
  });

  it('still boots in development so the project runs with no mail account', () => {
    // Contributors must be able to `npm run start:dev` without signing up for
    // an email provider — there the stub logging the code is the right answer.
    expect(() => serviceWith({ NODE_ENV: 'development' }).onModuleInit()).not.toThrow();
    expect(() => serviceWith({}).onModuleInit()).not.toThrow();
  });
});
