import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SmsResult = {
  ok: boolean;
  provider: 'twilio' | 'log' | 'disabled';
  sid?: string;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  private normalizeTnPhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (/^[0-9]{8}$/.test(digits)) return `+216${digits}`;
    if (/^216[0-9]{8}$/.test(digits)) return `+${digits}`;
    if (/^\+216[0-9]{8}$/.test(phone.trim())) return phone.trim();
    return null;
  }

  async send(to: string, body: string): Promise<SmsResult> {
    const e164 = this.normalizeTnPhone(to);
    if (!e164) {
      this.logger.warn(`SMS skipped — invalid phone « ${to} »`);
      return { ok: false, provider: 'disabled' };
    }

    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID')?.trim();
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN')?.trim();
    const from = this.config.get<string>('TWILIO_FROM')?.trim();
    const enabled =
      this.config.get<string>('SMS_ENABLED')?.toLowerCase() === 'true';

    if (!enabled || !sid || !token || !from) {
      this.logger.log(`[SMS:log] → ${e164} | ${body.replace(/\s+/g, ' ').slice(0, 200)}`);
      return { ok: true, provider: 'log' };
    }

    try {
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const params = new URLSearchParams({
        To: e164,
        From: from,
        Body: body.slice(0, 1600),
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (!res.ok) {
        const errText = await res.text();
        this.logger.warn(`Twilio failed ${res.status}: ${errText.slice(0, 200)}`);
        return { ok: false, provider: 'twilio' };
      }
      const data = (await res.json()) as { sid?: string };
      return { ok: true, provider: 'twilio', sid: data.sid };
    } catch (err) {
      this.logger.warn(`SMS error: ${String(err)}`);
      return { ok: false, provider: 'twilio' };
    }
  }
}
