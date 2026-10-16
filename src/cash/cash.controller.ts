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
import { LivreurDepositStatus, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CashService } from './cash.service';
import {
  CreateCashMovementDto,
  CreateLivreurDepositDto,
  RejectLivreurDepositDto,
} from './dto/cash.dto';

const MONEY = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.EXPERT_COMPTABLE,
  Role.CHEF_AGENCE,
  Role.FINANCE,
] as const;

const DEPOSIT_READ = [
  ...MONEY,
  Role.MAGASINIER,
  Role.LIVREUR,
] as const;

const DEPOSIT_REVIEW = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.EXPERT_COMPTABLE,
  Role.CHEF_AGENCE,
  Role.MAGASINIER,
] as const;

@ApiTags('cash')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Roles(...MONEY)
  @Get('registers')
  list(@CurrentUser() user: AuthUser) {
    return this.cash.listRegisters(user);
  }

  @Roles(...MONEY)
  @Post('registers/ensure')
  ensure(@CurrentUser() user: AuthUser) {
    return this.cash
      .ensureRegisters()
      .then(() => this.cash.listRegisters(user));
  }

  @Roles(...MONEY)
  @Get('registers/:id')
  one(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cash.getRegister(user, id);
  }

  @Roles(...MONEY)
  @Post('registers/:id/movements')
  move(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCashMovementDto,
  ) {
    return this.cash.addMovement(user, id, dto);
  }

  @Roles(Role.LIVREUR, Role.MAGASINIER, ...MONEY)
  @Get('deposits/open-cod')
  openCod(@CurrentUser() user: AuthUser) {
    return this.cash.livreurOpenCod(user);
  }

  @Roles(...DEPOSIT_READ)
  @Get('deposits')
  listDeposits(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: LivreurDepositStatus,
  ) {
    return this.cash.listDeposits(user, status);
  }

  @Roles(...DEPOSIT_READ)
  @Get('deposits/:id')
  oneDeposit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cash.getDeposit(user, id);
  }

  @Roles(Role.LIVREUR)
  @Post('deposits')
  createDeposit(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLivreurDepositDto,
  ) {
    return this.cash.createDeposit(user, dto);
  }

  @Roles(...DEPOSIT_REVIEW)
  @Post('deposits/:id/accept')
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cash.acceptDeposit(user, id);
  }

  @Roles(...DEPOSIT_REVIEW)
  @Post('deposits/:id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectLivreurDepositDto,
  ) {
    return this.cash.rejectDeposit(user, id, dto);
  }
}
