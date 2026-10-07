import { Module } from '@nestjs/common';
import { NavexService } from './navex.service';

@Module({
  providers: [NavexService],
  exports: [NavexService],
})
export class NavexModule {}
