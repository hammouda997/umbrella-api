import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateProfileDto,
  UpdateUserActiveDto,
  UpdateUserApprovalDto,
  UpdateUserDto,
  UpsertCreateParcelDraftDto,
} from './dto/user.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  list(@CurrentUser() user: AuthUser) {
    return this.users.list(user);
  }

  @Get('livreurs')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.CHEF_AGENCE,
    Role.MAGASINIER,
    Role.PICKUP,
    Role.SUPPORT,
    Role.LIVREUR,
  )
  listLivreurs() {
    return this.users.listLivreurs();
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user, dto);
  }

  @Patch('me/password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.users.changePassword(user, dto);
  }

  @Roles(
    Role.EXPEDITEUR,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.CHEF_AGENCE,
  )
  @Get('me/create-parcel-draft')
  getCreateParcelDraft(@CurrentUser() user: AuthUser) {
    return this.users.getCreateParcelDraft(user);
  }

  @Roles(
    Role.EXPEDITEUR,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.CHEF_AGENCE,
  )
  @Put('me/create-parcel-draft')
  upsertCreateParcelDraft(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertCreateParcelDraftDto,
  ) {
    return this.users.upsertCreateParcelDraft(user, dto.draft);
  }

  @Roles(
    Role.EXPEDITEUR,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.CHEF_AGENCE,
  )
  @Delete('me/create-parcel-draft')
  clearCreateParcelDraft(@CurrentUser() user: AuthUser) {
    return this.users.clearCreateParcelDraft(user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user, id, dto);
  }

  @Patch(':id/active')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  setActive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserActiveDto,
  ) {
    return this.users.setActive(user, id, dto.isActive);
  }

  @Patch(':id/approval')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  setApproval(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserApprovalDto,
  ) {
    return this.users.setApproval(user, id, dto.status);
  }
}
