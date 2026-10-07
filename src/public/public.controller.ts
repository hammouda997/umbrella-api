import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/auth.decorators';
import { ContactLeadDto, ForgotPasswordDto } from './dto/public.dto';

/**
 * Public lead / recovery endpoints.
 * Email delivery is not wired yet — requests are accepted, rate-limited, and logged
 * (and can be forwarded to CONTACT_INBOX via your mail provider later).
 */
@ApiTags('public')
@Controller()
export class PublicController {
  private readonly logger = new Logger(PublicController.name);

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('auth/forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    this.logger.log(
      `forgot-password request email=${dto.email.toLowerCase()} inbox=${process.env.CONTACT_INBOX ?? 'unset'}`,
    );
    return {
      ok: true,
      message:
        'Si un compte existe pour cet email, un lien de réinitialisation sera envoyé lorsque l’envoi d’emails sera configuré.',
    };
  }

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
