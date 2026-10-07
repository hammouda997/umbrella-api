import { Module } from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { ParcelsController } from './parcels.controller';
import { CodService } from './cod.service';
import { CodController } from './cod.controller';
import { NavexModule } from '../navex/navex.module';
import { DeliveryRoutesModule } from '../delivery-routes/delivery-routes.module';

@Module({
  imports: [NavexModule, DeliveryRoutesModule],
  controllers: [ParcelsController, CodController],
  providers: [ParcelsService, CodService],
})
export class ParcelsModule {}
