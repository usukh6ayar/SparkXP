import { Injectable, Logger } from '@nestjs/common';

/**
 * Email sender. Currently a STUB: it logs the message instead of sending, so
 * the OTP / reset flows work end-to-end in dev without an email provider.
 *
 * To go live, plug a real provider here (nodemailer SMTP, Resend, SES, …) read
 * from env (e.g. SMTP_HOST/SMTP_USER/SMTP_PASS) — nothing else needs to change.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');

  /** True once a real provider is configured (placeholder for now). */
  private get isLive(): boolean {
    return false;
  }

  async sendOtp(to: string, code: string): Promise<void> {
    await this.deliver(to, 'SparkXP баталгаажуулах код', `Таны код: ${code}`);
  }

  async sendPasswordReset(to: string, code: string): Promise<void> {
    await this.deliver(to, 'SparkXP нууц үг сэргээх', `Сэргээх код: ${code}`);
  }

  private async deliver(to: string, subject: string, body: string): Promise<void> {
    if (this.isLive) {
      // TODO: real provider send here.
      return;
    }
    // Dev stub: log so the code is visible while testing.
    this.logger.warn(`[STUB EMAIL] to=${to} | ${subject} | ${body}`);
  }
}
