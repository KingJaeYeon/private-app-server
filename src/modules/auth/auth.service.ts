import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import * as bcrypt from 'bcrypt';
import { User } from '@generated/prisma/client';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@/modules/auth/strategies/jwt.strategy';
import { add } from 'date-fns';
import { CookieOptions } from 'express';
import type { Response } from 'express';
import { AppConfig, ConfigKey } from '@/config/config.interface';
import { ConfigService } from '@nestjs/config';
import { SignUpDto } from '@/modules/auth/dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly db: PrismaService,
    private readonly configService: ConfigService<ConfigKey>
  ) {}

  async validateUser(identifier: string, password: string): Promise<User> {
    const user = await this.db.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }]
      }
    });
    if (!user) {
      throw new CustomException('INVALID_CREDENTIALS');
    }

    const isOAuth = user.password === null;
    if (isOAuth) {
      throw new CustomException('INVALID_CREDENTIALS');
    }

    // TODO: 사용자 상태 검증 ( 휴먼계정, 블랙리스트 등등)
    // TODO: Email 인증 여부

    const isPasswordValid = await bcrypt.compare(password, user.password as string);
    if (isPasswordValid) {
      throw new CustomException('INVALID_CREDENTIALS');
    }

    const { password: _, ...result } = user;
    return result as User;
  }

  async generateJwtTokens(payload: JwtPayload, userAgent: string, ipAddress: string) {
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = crypto.randomUUID();

    await this.db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.userId,
        expiredAt: add(new Date(), { days: 7 }), // 7일 후
        userAgent,
        ipAddress
      }
    });

    return { accessToken, refreshToken };
  }

  setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const { accessToken, refreshToken } = tokens;
    const appConfig: AppConfig = this.configService.getOrThrow('app');
    const isProduction = process.env.NODE_ENV === 'production';

    const baseOptions: CookieOptions = {
      httpOnly: true,
      secure: isProduction,
      domain: isProduction ? appConfig.domain : undefined
    };

    res.cookie('access', accessToken, {
      ...baseOptions,
      sameSite: 'lax',
      path: '/'
    });

    res.cookie('refresh', refreshToken, {
      ...baseOptions,
      sameSite: 'strict',
      path: '/auth/refresh'
    });
  }

  // 임시
  async signUp(dto: SignUpDto) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email }
    });

    if (user) {
      throw new CustomException('EMAIL_ALREADY_EXISTS');
    }

    const latestVerification = await this.db.verification.findFirst({
      where: { email: dto.email, type: 'EMAIL_VERIFICATION', expiredAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });

    if (!(latestVerification && latestVerification.token === dto.verifyCode)) {
      throw new CustomException('VERIFICATION_INVALID');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.db.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        username: dto.email.split('@')[0],
        emailVerified: new Date()
      }
    });
  }
}
