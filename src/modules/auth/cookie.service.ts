import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IConfigKey } from '@/config/config.interface';
import type { Response } from 'express';
import { CookieOptions } from 'express';
import { AUTH_COOKIE } from '@/common/constants/auth';
import { TokenPair } from '@/common/interface/jwt.interface';

@Injectable()
export class CookieService {
  constructor(private readonly configService: ConfigService<IConfigKey>) {}

  setTokenPair(res: Response, tokens: TokenPair): void {
    this.setAccessToken(res, tokens.accessToken);
    this.setRefreshToken(res, tokens.refreshToken);
  }

  clearAuthCookies(res: Response): void {
    const expired = new Date(0);
    res.cookie(AUTH_COOKIE.ACCESS, '', { expires: expired, path: '/' });
    res.cookie(AUTH_COOKIE.REFRESH, '', { expires: expired, path: '/auth' });
  }

  setAccessToken(res: Response, value: string) {
    const base = this.getCookieBaseOptions();

    res.cookie(AUTH_COOKIE.ACCESS, value ?? '', {
      ...base,
      sameSite: 'lax',
      path: '/'
    });
  }

  setRefreshToken(res: Response, value: string | null) {
    const base = this.getCookieBaseOptions();

    res.cookie(AUTH_COOKIE.REFRESH, value ?? '', {
      ...base,
      sameSite: 'strict',
      path: `/auth`
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
