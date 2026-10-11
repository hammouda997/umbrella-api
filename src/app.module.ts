import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ParcelsModule } from './parcels/parcels.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ZonesModule } from './zones/zones.module';
import { StatusCategoriesModule } from './status-categories/status-categories.module';
import { AgenciesModule } from './agencies/agencies.module';
import { DeliveryRoutesModule } from './delivery-routes/delivery-routes.module';
import { NavexModule } from './navex/navex.module';
import { UsersModule } from './users/users.module';
import { TicketsModule } from './tickets/tickets.module';
import { PaymentsModule } from './payments/payments.module';
import { CommsModule } from './comms/comms.module';
import { PublicModule } from './public/public.module';
import { ReturnLotsModule } from './return-lots/return-lots.module';
import { PickupManifestsModule } from './pickup-manifests/pickup-manifests.module';
import { SupportBotModule } from './support-bot/support-bot.module';
import { SmsModule } from './sms/sms.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    SmsModule,
    AuthModule,
    NavexModule,
    UsersModule,
    ParcelsModule,
    TicketsModule,
    PaymentsModule,
    ReturnLotsModule,
    PickupManifestsModule,
    SupportBotModule,
    DashboardModule,
    ZonesModule,
    StatusCategoriesModule,
    AgenciesModule,
    DeliveryRoutesModule,
    CommsModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
