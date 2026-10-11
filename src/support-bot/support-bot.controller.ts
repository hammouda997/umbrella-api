import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { SupportBotChatDto } from './dto/support-bot.dto';
import { SupportBotService } from './support-bot.service';

@ApiTags('support-bot')
@ApiBearerAuth()
@Controller('support-bot')
@UseGuards(RolesGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.SUPPORT,
  Role.EXPEDITEUR,
  Role.CLIENT,
  Role.LIVREUR,
  Role.MAGASINIER,
  Role.CHEF_AGENCE,
  Role.PICKUP,
  Role.FINANCE,
)
export class SupportBotController {
  constructor(private readonly bot: SupportBotService) {}

  @Post('chat')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  chat(@CurrentUser() user: AuthUser, @Body() dto: SupportBotChatDto) {
    return this.bot.chat(user, dto);
  }
}
