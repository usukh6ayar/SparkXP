import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Email sender. Picks a provider from env at runtime:
 *   1. RESEND_API_KEY          → Resend HTTP API (no SMTP server needed)
 *   2. SMTP_HOST (+ user/pass) → SMTP via nodemailer
 *   3. neither                 → dev STUB (logs the message)
 *
 * `MAIL_FROM` sets the From address (default a Resend test sender). Switching
 * providers is purely env config — no code change.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private get from(): string {
    return this.config.get<string>('MAIL_FROM') ?? 'SparkXP <onboarding@resend.dev>';
  }

  async sendOtp(to: string, code: string): Promise<void> {
    await this.deliver(
      to,
      'SparkXP баталгаажуулах код',
      `Таны баталгаажуулах код: ${code}\n\nЭнэ код 10 минутын дараа хүчингүй болно.`,
    );
  }

  async sendPasswordReset(to: string, code: string): Promise<void> {
    await this.deliver(
      to,
      'SparkXP нууц үг сэргээх',
      `Нууц үг сэргээх код: ${code}\n\nХэрэв та хүсэлт гаргаагүй бол энэ имэйлийг үл тоомсорло.`,
    );
  }

  private async deliver(to: string, subject: string, text: string): Promise<void> {
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (resendKey) {
      await this.sendViaResend(resendKey, to, subject, text);
      return;
    }

    if (this.config.get<string>('SMTP_HOST')) {
      await this.sendViaSmtp(to, subject, text);
      return;
    }

    // Dev stub: log so the code is visible while testing.
    this.logger.warn(`[STUB EMAIL] to=${to} | ${subject} | ${text}`);
  }

  private async sendViaResend(
    apiKey: string,
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to, subject, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Resend email failed (${res.status}): ${body}`);
      throw new Error('Имэйл илгээхэд алдаа гарлаа');
    }
  }

  private async sendViaSmtp(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.getOrThrow<string>('SMTP_HOST'),
        port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}
