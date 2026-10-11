import { Global, Module } from '@nestjs/common';
import { ClientAccountsService } from './client-accounts.service';
import { SmsService } from './sms.service';

@Global()
@Module({
  providers: [SmsService, ClientAccountsService],
  exports: [SmsService, ClientAccountsService],
})
export class SmsModule {}
