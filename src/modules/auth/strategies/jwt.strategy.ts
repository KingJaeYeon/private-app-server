import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { IConfigKey, IJWTConfig } from '@/config/config.interface';
import { AUTH_COOKIE } from '@/common/constants/auth';

export interface IJwtPayload {
  userId: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService<IConfigKey>) {
    const jwt: IJWTConfig = configService.getOrThrow('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies[AUTH_COOKIE.ACCESS] || null, // 쿠키에서 추출
        ExtractJwt.fromAuthHeaderAsBearerToken(), // Authorization 헤더에서 추출
        ExtractJwt.fromUrlQueryParameter('token') // URL 쿼리 파라미터에서 추출
      ]),
      ignoreExpiration: false,
      secretOrKey: jwt.secret
    });
  }

  async validate(payload: IJwtPayload) {
    // payload 검증 후 req.user에 저장
    return {
      userId: payload.userId,
      email: payload.email
    };
  }
}
