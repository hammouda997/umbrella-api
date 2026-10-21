import { Module } from '@nestjs/common';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [PlatformSettingsModule],
  controllers: [DashboardController, NotificationsController],
  providers: [DashboardService, NotificationsService],
})
export class DashboardModule {}
