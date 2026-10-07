import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, UpdateTicketStatusDto } from './dto/ticket.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXPEDITEUR, Role.CLIENT)
  @Post()
  create(
    @CurrentUser() user: { id: number; role: Role; email: string },
    @Body() dto: CreateTicketDto,
  ) {
    return this.tickets.create(user, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXPEDITEUR, Role.CLIENT)
  list(@CurrentUser() user: { id: number; role: Role; email: string }) {
    return this.tickets.list(user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXPEDITEUR, Role.CLIENT)
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { id: number; role: Role; email: string },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.tickets.updateStatus(user, id, dto);
  }
}
