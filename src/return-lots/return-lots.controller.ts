import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateReturnLotDto } from './dto/return-lot.dto';
import { ReturnLotsService } from './return-lots.service';

@ApiTags('return-lots')
@ApiBearerAuth()
@Controller('return-lots')
export class ReturnLotsController {
  constructor(private readonly lots: ReturnLotsService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.EXPEDITEUR)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReturnLotDto) {
    return this.lots.create(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(
    Role.EXPEDITEUR,
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.CHEF_AGENCE,
    Role.MAGASINIER,
    Role.SUPPORT,
    Role.PICKUP,
    Role.LIVREUR,
  )
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.lots.list(user);
  }

  @UseGuards(RolesGuard)
  @Roles(
    Role.EXPEDITEUR,
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.CHEF_AGENCE,
    Role.MAGASINIER,
    Role.SUPPORT,
    Role.PICKUP,
    Role.LIVREUR,
  )
  @Get('by-code/:code')
  byCode(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.lots.findByCode(user, code);
  }

  @UseGuards(RolesGuard)
  @Roles(
    Role.EXPEDITEUR,
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.CHEF_AGENCE,
    Role.MAGASINIER,
    Role.SUPPORT,
    Role.PICKUP,
    Role.LIVREUR,
  )
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.lots.findOne(user, id);
  }
}
