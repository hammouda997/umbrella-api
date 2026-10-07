import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as qs from 'qs';

export type NavexCreatePayload = Record<string, string | number | boolean>;

export type NavexCreateResponse = {
  status_message?: string;
  lien?: string;
  [key: string]: unknown;
};

export type NavexStatusResponse = { etat?: string; [key: string]: unknown };

@Injectable()
export class NavexService {
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;
  /** Merchant slug / creds — e.g. apex-delivery */
  private readonly slug: string;
  /** Optional extra API token after the slug (legacy long keys) */
  private readonly key: string;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('NAVEX_ENABLED') === 'true';
    this.baseUrl =
      config.get<string>('NAVEX_API_BASE_URL') ?? 'https://app.navex.tn/api';
    this.slug =
      config.get<string>('NAVEX_CLIENT_SLUG') ??
      config.get<string>('NAVEX_API_KEY') ??
      'apex-delivery';
    this.key = config.get<string>('NAVEX_API_TOKEN') ?? '';
    this.http = axios.create({
      timeout: 15_000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  /** Remote calls are opt-in so local and demo environments never touch the live Navex account. */
  isEnabled(): boolean {
    return this.enabled && Boolean(this.slug);
  }

  private requireSlug() {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException('Navex integration is disabled');
    }
    if (!this.slug) {
      throw new ServiceUnavailableException(
        'NAVEX_CLIENT_SLUG (or NAVEX_API_KEY) is not configured',
      );
    }
  }

  /** create: `{slug}` or `{slug}-{token}` */
  private createPath() {
    return this.key ? `${this.slug}-${this.key}` : this.slug;
  }

  /** delete: `{slug}-delete` or `{slug}-delete-{token}` */
  private deletePath() {
    return this.key ? `${this.slug}-delete-${this.key}` : `${this.slug}-delete`;
  }

  /** etat: `{slug}-etat` or `{slug}-etat-{token}` */
  private etatPath() {
    return this.key ? `${this.slug}-etat-${this.key}` : `${this.slug}-etat`;
  }

  async createParcel(
    payload: NavexCreatePayload,
  ): Promise<NavexCreateResponse> {
    this.requireSlug();
    const url = `${this.baseUrl}/${this.createPath()}/v1/post.php`;
    const response = await this.http.post<NavexCreateResponse>(
      url,
      qs.stringify(payload),
    );
    return response.data;
  }

  async deleteParcel(deleteCode: string): Promise<Record<string, unknown>> {
    this.requireSlug();
    const url = `${this.baseUrl}/${this.deletePath()}/v1/post.php`;
    const response = await this.http.post<Record<string, unknown>>(
      url,
      qs.stringify({ delete_code: deleteCode }),
    );
    return response.data;
  }

  async getStatus(code: string): Promise<NavexStatusResponse> {
    this.requireSlug();
    const url = `${this.baseUrl}/${this.etatPath()}/v1/post.php`;
    const response = await this.http.post<NavexStatusResponse>(
      url,
      qs.stringify({ code }),
    );
    return response.data;
  }
}
