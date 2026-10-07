import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { DeliveryRoutesService } from './delivery-routes.service';
import {
  BulkUpsertDeliveryRoutesDto,
  UpsertDeliveryRouteDto,
} from './dto/delivery-route.dto';

@ApiTags('delivery-routes')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('delivery-routes')
export class DeliveryRoutesController {
  constructor(private readonly routes: DeliveryRoutesService) {}

  /** Readable by staff who create parcels (to auto-fill mode). */
  @Get()
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.CHEF_AGENCE,
    Role.EXPEDITEUR,
  )
  list() {
    return this.routes.list();
  }

  @Get('resolve/:governorate')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.CHEF_AGENCE,
    Role.EXPEDITEUR,
  )
  async resolve(@Param('governorate') governorate: string) {
    const mode = await this.routes.resolveMode(
      decodeURIComponent(governorate),
    );
    return { governorate: decodeURIComponent(governorate), mode };
  }

  @Put()
  @Roles(Role.SUPER_ADMIN)
  upsert(@Body() dto: UpsertDeliveryRouteDto) {
    return this.routes.upsertOne(dto);
  }

  @Put('bulk')
  @Roles(Role.SUPER_ADMIN)
  bulk(@Body() dto: BulkUpsertDeliveryRoutesDto) {
    return this.routes.upsertMany(dto);
  }

  @Delete(':governorate')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('governorate') governorate: string) {
    return this.routes.remove(decodeURIComponent(governorate));
  }
}
