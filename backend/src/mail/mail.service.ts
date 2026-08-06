import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Email sender. Picks a provider from env at runtime:
 *   1. BREVO_API_KEY           → Brevo HTTPS API
 *   2. RESEND_API_KEY          → Resend HTTPS API
 *   3. SMTP_HOST (+ user/pass) → SMTP via nodemailer
 *   4. none                    → dev STUB (logs the message)
 *
 * ⚠️ **On Railway, SMTP does not work below the Pro plan** — outbound ports
 * 25/465/587 are blocked, so nodemailer just hangs until it times out and the
 * HTTP request hangs with it. That is not a misconfiguration and no env value
 * fixes it. Use one of the HTTPS providers there (both are unaffected).
 * Brevo is listed first because it is the only one that sends to arbitrary
 * recipients without owning a domain — Resend restricts an unverified account
 * to the owner's own address.
 *
 * `MAIL_FROM` sets the From address (default a Resend test sender). Switching
 * providers is purely env config — no code change needed.
 *
 * ⚠️ **The stub must never run in production.** Registration emails the user a
 * 6-digit code and cannot complete without it, so an unconfigured production
 * deploy would look healthy while every single signup silently dead-ends —
 * and the codes would sit in the server logs, where anyone with log access
 * could verify anyone's account. `onModuleInit` therefore refuses to boot
 * instead of degrading quietly.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger('MailService');
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  /** True when a real provider (Resend or SMTP) is configured. */
  private get configured(): boolean {
    return !!(
      this.config.get<string>('BREVO_API_KEY') ||
      this.config.get<string>('RESEND_API_KEY') ||
      this.config.get<string>('SMTP_HOST')
    );
  }

  private get isProduction(): boolean {
    return (this.config.get<string>('NODE_ENV') ?? 'development') === 'production';
  }

  onModuleInit(): void {
    if (this.configured) return;

    if (this.isProduction) {
      // Fail the deploy, loudly. A silent stub here is indistinguishable from
      // a working app until the first real user tries to sign up.
      throw new Error(
        'MailService: no email provider configured. Set BREVO_API_KEY, ' +
          'RESEND_API_KEY or SMTP_HOST — without one, nobody can verify their ' +
          'email and no account can be created. See backend/.env.example.',
      );
    }

    this.logger.warn(
      'No email provider configured — OTP codes will be logged, not emailed. ' +
        'Fine for local dev; set BREVO_API_KEY (or RESEND_API_KEY) before deploying.',
    );
  }

  private get from(): string {
    return (
      this.config.get<string>('MAIL_FROM') ?? 'SparkXP <onboarding@resend.dev>'
    );
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

  private async deliver(
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
    const brevoKey = this.config.get<string>('BREVO_API_KEY');
    if (brevoKey) {
      await this.sendViaBrevo(brevoKey, to, subject, text);
      return;
    }

    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (resendKey) {
      await this.sendViaResend(resendKey, to, subject, text);
      return;
    }

    if (this.config.get<string>('SMTP_HOST')) {
      await this.sendViaSmtp(to, subject, text);
      return;
    }

    // Dev stub: log so the code is visible while testing without a provider.
    this.logger.warn(`[STUB EMAIL] to=${to} | ${subject} | ${text}`);
  }

  /**
   * Brevo needs the sender as `{ name, email }`, while `MAIL_FROM` is the usual
   * `Name <addr@host>` string. Falls back to treating the whole value as the
   * address when it has no angle brackets.
   */
  private splitFrom(): { name: string; email: string } {
    const raw = this.from.trim();
    const match = /^(.*?)\s*<([^>]+)>$/.exec(raw);
    return match
      ? { name: match[1].replace(/^"|"$/g, '').trim() || 'SparkXP', email: match[2].trim() }
      : { name: 'SparkXP', email: raw };
  }

  private async sendViaBrevo(
    apiKey: string,
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: this.splitFrom(),
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // The body carries the actionable part (unverified sender, bad key, quota)
      // — logging only the status would send us hunting through Brevo's UI.
      this.logger.error(`Brevo email failed (${res.status}): ${body}`);
      throw new Error('Имэйл илгээхэд алдаа гарлаа');
    }
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

  private async sendViaSmtp(
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
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
