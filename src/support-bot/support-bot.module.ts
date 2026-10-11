import { Module } from '@nestjs/common';
import { SupportBotController } from './support-bot.controller';
import { SupportBotService } from './support-bot.service';

@Module({
  controllers: [SupportBotController],
  providers: [SupportBotService],
})
export class SupportBotModule {}
