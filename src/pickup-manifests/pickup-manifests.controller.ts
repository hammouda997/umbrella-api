import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PickupManifestKind, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePickupManifestDto } from './dto/pickup-manifest.dto';
import { PickupManifestsService } from './pickup-manifests.service';

const READ_ROLES = [
  Role.EXPEDITEUR,
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.CHEF_AGENCE,
  Role.MAGASINIER,
  Role.SUPPORT,
  Role.PICKUP,
  Role.LIVREUR,
] as const;

const CREATE_ROLES = [
  Role.EXPEDITEUR,
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.CHEF_AGENCE,
  Role.MAGASINIER,
  Role.PICKUP,
] as const;

@ApiTags('pickup-manifests')
@ApiBearerAuth()
@Controller('pickup-manifests')
export class PickupManifestsController {
  constructor(private readonly manifests: PickupManifestsService) {}

  @UseGuards(RolesGuard)
  @Roles(...CREATE_ROLES)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePickupManifestDto,
  ) {
    return this.manifests.create(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('kind') kind?: PickupManifestKind,
  ) {
    return this.manifests.list(user, kind);
  }

  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  @Get('by-code/:code')
  byCode(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.manifests.findByCode(user, code);
  }

  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.manifests.findOne(user, id);
  }
}
