import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CommsService } from './comms.service';
import { CommsController } from './comms.controller';
import { CommsGateway } from './comms.gateway';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CommsController],
  providers: [CommsService, CommsGateway],
  exports: [CommsService, CommsGateway],
})
export class CommsModule {}
