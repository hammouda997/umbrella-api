import { Module } from '@nestjs/common';
import { PickupManifestsController } from './pickup-manifests.controller';
import { PickupManifestsService } from './pickup-manifests.service';

@Module({
  controllers: [PickupManifestsController],
  providers: [PickupManifestsService],
  exports: [PickupManifestsService],
})
export class PickupManifestsModule {}
