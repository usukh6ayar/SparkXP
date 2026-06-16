import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Email sending (stub for now). Global so any feature can inject MailService. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
