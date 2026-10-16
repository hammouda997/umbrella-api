import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/auth.decorators';
import { ContactLeadDto } from './dto/public.dto';

/**
 * Public lead endpoints.
 * Email delivery is not wired yet — requests are accepted, rate-limited, and logged.
 */
@ApiTags('public')
@Controller()
export class PublicController {
  private readonly logger = new Logger(PublicController.name);

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('public/contact')
  contact(@Body() dto: ContactLeadDto) {
    this.logger.log(
      `contact lead name=${dto.name} email=${dto.email} phone=${dto.phone} company=${dto.company ?? ''} interests=${(dto.interests ?? []).join(',')}`,
    );
    return {
      ok: true,
      message: 'Demande reçue — nous vous recontactons bientôt.',
    };
  }
}
