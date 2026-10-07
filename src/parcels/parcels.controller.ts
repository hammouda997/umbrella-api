import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { ParcelsService } from './parcels.service';
import {
  AssignDriverDto,
  CreateParcelDto,
  ScanParcelDto,
  SwitchParcelModeDto,
  UpdateParcelDto,
  UpdateParcelStatusDto,
} from './dto/parcel.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public, Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('parcels')
@Controller('parcels')
export class ParcelsController {
  constructor(private readonly parcels: ParcelsService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('track/:code')
  track(@Param('code') code: string) {
    return this.parcels.trackByCode(code);
  }

  @ApiBearerAuth()
  @Get('by-code/:code')
  findByCode(
    @CurrentUser() user: { id: number; role: Role; email: string },
    @Param('code') code: string,
  ) {
    return this.parcels.findByCodeForUser(user, code);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.CHEF_AGENCE,
    Role.LIVREUR,
    Role.PICKUP,
    Role.MAGASINIER,
    Role.SUPPORT,
  )
  @Post('scan')
  scan(
    @CurrentUser() user: { id: number; role: Role; email: string },
    @Body() dto: ScanParcelDto,
  ) {
    return this.parcels.scan(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.CHEF_AGENCE, Role.EXPEDITEUR)
  @Post()
  create(
    @CurrentUser() user: { id: number; role: Role; email: string },
    @Body() dto: CreateParcelDto,
  ) {
    return this.parcels.create(user, dto);
  }

  @ApiBearerAuth()
  @Get()
  list(@CurrentUser() user: { id: number; role: Role; email: string }) {
    return this.parcels.list(user);
  }

  @ApiBearerAuth()
  @Get(':id')
  findOne(
    @CurrentUser() user: { id: number; role: Role; email: string },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.parcels.findOneForUser(user, id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('sync-external')
  sync(@CurrentUser() user: { id: number; role: Role; email: string }) {
    return this.parcels.syncExternalStatuses(user);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.CHEF_AGENCE, Role.EXPEDITEUR)
  @Patch(':id/mode')
  switchMode(
    @CurrentUser() user: { id: number; role: Role; email: string },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SwitchParcelModeDto,
  ) {
    return this.parcels.switchMode(user, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.CHEF_AGENCE, Role.EXPEDITEUR)
  @Patch(':id')
  update(
    @CurrentUser() user: { id: number; role: Role; email: string },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParcelDto,
  ) {
    return this.parcels.update(user, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.CHEF_AGENCE, Role.EXPEDITEUR)
  @Delete(':id')
  remove(
    @CurrentUser() user: { id: number; role: Role; email: string },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.parcels.softDelete(user, id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.CHEF_AGENCE,
    Role.MAGASINIER,
    Role.PICKUP,
  )
  @Patch(':id/assign')
  assign(
    @CurrentUser() user: { id: number; role: Role; email: string },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignDriverDto,
  ) {
    return this.parcels.assignDriver(user, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.CHEF_AGENCE,
    Role.LIVREUR,
    Role.PICKUP,
    Role.MAGASINIER,
    Role.SUPPORT,
  )
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { id: number; role: Role; email: string },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParcelStatusDto,
  ) {
    return this.parcels.updateStatus(user, id, dto);
  }
}
