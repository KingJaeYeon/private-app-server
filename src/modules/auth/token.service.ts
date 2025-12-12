import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { IJwtPayload } from '@/modules/auth/strategies/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { IConfigKey, IJWTConfig } from '@/config/config.interface';

@Injectable()
export class TokenService {
  constructor(
    private readonly db: PrismaService,
    private readonly configService: ConfigService<IConfigKey>,
    private readonly jwt: JwtService
  ) {}

  generateToken(payload: IJwtPayload) {
    const config: IJWTConfig = this.configService.getOrThrow('jwt');

    const accessToken = this.jwt.sign(payload, {
      expiresIn: config.access.expiresIn,
      secret: config.access.secret
    });
    const refreshToken = this.jwt.sign(payload, {
      expiresIn: config.refresh.expiresIn,
      secret: config.refresh.secret
    });

    return { accessToken, refreshToken };
  }
}
