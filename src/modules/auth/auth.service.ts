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

  async signIn(user: User) {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    };
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
  async signUp(email: string, username: string, password: string) {
    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.db.user.create({
      data: {
        email,
        username,
        password: hashedPassword
      }
    });

    return this.signIn(user);
  }
}
