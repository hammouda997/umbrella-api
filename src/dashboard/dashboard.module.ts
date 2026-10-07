import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [DashboardController, NotificationsController],
  providers: [DashboardService, NotificationsService],
})
export class DashboardModule {}
