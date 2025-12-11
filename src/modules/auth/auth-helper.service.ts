import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IConfigKey, IAppConfig } from '@/config/config.interface';
import type { Response } from 'express';
import { CookieOptions } from 'express';
import { AUTH_COOKIE } from '@/common/constants/auth';

@Injectable()
export class AuthHelperService {
  constructor(private readonly configService: ConfigService<IConfigKey>) {}

  setAccessCookie(res: Response, value: string | null, expires?: Date) {
    const base = this.getCookieBaseOptions();
    res.cookie(AUTH_COOKIE.ACCESS, value ?? '', {
      ...base,
      sameSite: 'lax',
      path: '/',
      expires
    });
  }

  setRefreshCookie(res: Response, value: string | null, expires?: Date) {
    const base = this.getCookieBaseOptions();
    res.cookie(AUTH_COOKIE.REFRESH, value ?? '', {
      ...base,
      sameSite: 'strict',
      path: `/`,
      expires
    });
  }

  private getCookieBaseOptions(): CookieOptions {
    const { domain } = this.configService.getOrThrow('app');
    const nodeEnv = this.configService.getOrThrow('nodeEnv');

    return {
      httpOnly: true,
      secure: nodeEnv === 'production',
      domain: nodeEnv === 'production' ? domain : undefined
    };
  }
}
