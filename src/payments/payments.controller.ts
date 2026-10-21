import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentRequestDto,
  UpdatePaymentStatusDto,
  UploadPaymentDechargeDto,
} from './dto/payment.dto';

const STAFF = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.EXPERT_COMPTABLE,
  Role.CHEF_AGENCE,
  Role.FINANCE,
] as const;

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Roles(...STAFF, Role.EXPEDITEUR)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.payments.list(user);
  }

  @Roles(...STAFF)
  @Get('budget-status')
  budget(@CurrentUser() user: AuthUser) {
    return this.payments.budgetStatus(user);
  }

  @Roles(Role.EXPERT_COMPTABLE, Role.SUPER_ADMIN, Role.ADMIN)
  @Post('expert-batch')
  expertBatch(
    @CurrentUser() user: AuthUser,
    @Query('agencyId') agencyId?: string,
  ) {
    const id = agencyId ? Number(agencyId) : undefined;
    return this.payments.expertBatchPay(
      user,
      id != null && Number.isFinite(id) ? id : undefined,
    );
  }

  /** Staff only — expéditeur never creates a demande. */
  @Roles(...STAFF)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePaymentRequestDto,
  ) {
    return this.payments.create(user, dto);
  }

  @Roles(...STAFF)
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.payments.updateStatus(user, id, dto);
  }

  /** Expéditeur uploads signed décharge → PAYÉ. */
  @Roles(Role.EXPEDITEUR)
  @Post(':id/decharge')
  uploadDecharge(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UploadPaymentDechargeDto,
  ) {
    return this.payments.uploadDecharge(user, id, dto.dechargeUrl);
  }
}
