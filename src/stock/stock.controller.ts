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
import { Role } from '@prisma/client';
import { StockService } from './stock.service';
import {
  AdjustStockQtyDto,
  CreateStockItemDto,
  UpdateStockItemDto,
} from './dto/stock.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.EXPEDITEUR)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.stock.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockItemDto) {
    return this.stock.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockItemDto,
  ) {
    return this.stock.update(user, id, dto);
  }

  @Post(':id/adjust')
  adjust(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdjustStockQtyDto,
  ) {
    return this.stock.adjust(user, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.stock.remove(user, id);
  }
}
