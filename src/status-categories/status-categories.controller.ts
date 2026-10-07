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
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateStatusCategoryDto,
  UpdateStatusCategoryDto,
} from './dto/status-category.dto';
import { StatusCategoriesService } from './status-categories.service';

@ApiTags('status-categories')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('status-categories')
export class StatusCategoriesController {
  constructor(private readonly categories: StatusCategoriesService) {}

  @Get()
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.CHEF_AGENCE,
    Role.SUPPORT,
    Role.PICKUP,
    Role.MAGASINIER,
    Role.EXPEDITEUR,
    Role.LIVREUR,
    Role.CLIENT,
  )
  list() {
    return this.categories.list();
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateStatusCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusCategoryDto,
  ) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categories.remove(id);
  }
}
