/**
 * Send one real email through whatever provider `.env` is configured with.
 *
 *   npm run test:email you@example.com
 *
 * Why this exists: email is the single point of failure in registration — a
 * user who never receives the 6-digit code cannot create an account, and the
 * app itself gives no signal that the send failed. This proves the provider
 * works BEFORE a real user finds out it doesn't.
 *
 * It uses the same `MailService` the app does, so a pass here means signup
 * emails will genuinely go out — not just that some SMTP library is happy.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes('@')) {
    console.error('Хэрэглээ: npm run test:email -- you@example.com');
    process.exit(1);
  }

  // The real ConfigService reads process.env, which dotenv has just filled.
  const config = new ConfigService();
  const mail = new MailService(config);

  const provider = process.env.BREVO_API_KEY
    ? 'Brevo (HTTPS)'
    : process.env.RESEND_API_KEY
      ? 'Resend (HTTPS)'
      : process.env.SMTP_HOST
        ? `SMTP (${process.env.SMTP_HOST})`
        : null;

  if (!provider) {
    console.error(
      '❌ Провайдер тохируулаагүй байна.\n' +
        '   BREVO_API_KEY, RESEND_API_KEY эсвэл SMTP_HOST-ыг .env-д тавина уу.\n' +
        '   Ингэж орхивол production дээр хэн ч бүртгүүлж чадахгүй.',
    );
    process.exit(1);
  }

  console.log(`Провайдер : ${provider}`);
  console.log(`From      : ${process.env.MAIL_FROM ?? '(анхдагч)'}`);
  console.log(`To        : ${to}`);
  console.log('Илгээж байна…');

  // A fixed code, not a random one — this is a delivery test, and a constant
  // makes it obvious in the inbox that it came from here and not a real signup.
  await mail.sendOtp(to, '123456');

  console.log('\n✅ Илгээгдлээ. Одоо шалгаарай:');
  console.log('   1. Inbox-д ирсэн үү?');
  console.log('   2. Spam / Promotions таб руу ороогүй биз? ← хамгийн чухал нь');
  console.log('   3. Илгээгчийн нэр зөв харагдаж байна уу?');
  console.log('\n   Spam-д орсон бол жинхэнэ хэрэглэгчид ч мөн адил орно —');
  console.log('   өөрийн домэйн + SPF/DKIM шаардлагатай.');
  if (process.env.SMTP_HOST && !process.env.BREVO_API_KEY && !process.env.RESEND_API_KEY) {
    console.log(
      '\n⚠️  SMTP нь ЛОКАЛ дээр ажиллаж байгаа ч Railway-гийн Hobby багц дээр\n' +
        '   гадагш чиглэсэн SMTP порт (25/465/587) ХААЛТТАЙ. Prod дээр энэ\n' +
        '   тохиргоо өлгөгдөнө. Тэнд BREVO_API_KEY (HTTPS) ашиглана уу.',
    );
  }
}

main().catch((err) => {
  console.error('\n❌ Илгээж чадсангүй:\n', err instanceof Error ? err.message : err);
  process.exit(1);
});
