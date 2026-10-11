import { Module } from '@nestjs/common';
import { ReturnLotsController } from './return-lots.controller';
import { ReturnLotsService } from './return-lots.service';

@Module({
  controllers: [ReturnLotsController],
  providers: [ReturnLotsService],
  exports: [ReturnLotsService],
})
export class ReturnLotsModule {}
