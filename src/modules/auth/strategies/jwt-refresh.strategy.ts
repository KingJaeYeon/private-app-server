import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { IConfigKey, IJWTConfig } from '@/config/config.interface';
import { AuthService } from '@/modules/auth/auth.service';
import { Request } from 'express';
import { AUTH_COOKIE } from '@/common/constants/auth';
import { IJwtPayload } from '@/modules/auth/strategies/jwt.strategy';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    configService: ConfigService<IConfigKey>,
    private readonly authService: AuthService
  ) {
    const jwt: IJWTConfig = configService.getOrThrow('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([(req: Request) => req?.cookies[AUTH_COOKIE.REFRESH]]),
      secretOrKey: jwt.refresh.secret,
      passReqToCallback: true
    });
  }

  async validate(request: Request, payload: IJwtPayload) {
    return this.authService.verifyRefreshToken(request.cookies[AUTH_COOKIE.REFRESH], payload.userId);
  }
}
