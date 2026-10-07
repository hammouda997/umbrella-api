import { Module } from '@nestjs/common';
import { DeliveryRoutesController } from './delivery-routes.controller';
import { DeliveryRoutesService } from './delivery-routes.service';

@Module({
  controllers: [DeliveryRoutesController],
  providers: [DeliveryRoutesService],
  exports: [DeliveryRoutesService],
})
export class DeliveryRoutesModule {}
