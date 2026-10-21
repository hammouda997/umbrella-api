import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdatePlatformSettingsDto } from './dto/platform-settings.dto';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('settings/platform')
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.EXPEDITEUR,
    Role.FINANCE,
    Role.CHEF_AGENCE,
    Role.EXPERT_COMPTABLE,
  )
  @Get()
  get() {
    return this.settings.getPlatform();
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch()
  update(@Body() dto: UpdatePlatformSettingsDto) {
    return this.settings.updatePlatform(dto);
  }
}
