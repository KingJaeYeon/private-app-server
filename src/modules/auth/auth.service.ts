import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import * as bcrypt from 'bcrypt';
import { User } from '@generated/prisma/client';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@/modules/auth/strategies/jwt.strategy';
import { add } from 'date-fns';
import type { Response } from 'express';
import { CookieOptions } from 'express';
import { AppConfig, ConfigKey } from '@/config/config.interface';
import { ConfigService } from '@nestjs/config';
import { SignUpDto } from '@/modules/auth/dto';
import { getRandomString } from '@/common/util/util';
import { AUTH_COOKIE } from '@/common/constants/auth';

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

  async generateJwtTokens({
    payload,
    ipAddress,
    userAgent
  }: {
    payload: JwtPayload;
    userAgent: string;
    ipAddress: string;
  }) {
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = getRandomString();

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

  async clearAuthCookies(res: Response, refreshToken: string) {
    if (refreshToken) {
      const token = await this.db.refreshToken.findUnique({
        where: { token: refreshToken }
      });

      if (token) {
        await this.db.refreshToken.update({
          where: { id: token.id },
          data: { revokedAt: new Date() }
        });
      }
    }
    const expired = new Date(0);
    this.setAccessCookie(res, null, expired);
    this.setRefreshCookie(res, null, expired);
  }

  setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    this.setAccessCookie(res, tokens.accessToken);
    this.setRefreshCookie(res, tokens.refreshToken);
  }

  async rotateRefreshToken(refreshToken: string, ipAddress: string, userAgent: string) {
    const storedToken = await this.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!storedToken) {
      throw new CustomException('INVALID_TOKEN');
    }

    const invalidToken = storedToken.revokedAt || storedToken.expiredAt < new Date();
    if (invalidToken) {
      await this.db.refreshToken
        .delete({
          where: { id: storedToken.id }
        })
        .then((r) => console.log('>> invalidToken:: delete', r.id));
      throw new CustomException('REFRESH_TOKEN_EXPIRED');
    }

    await this.db.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() }
    });

    const payload: JwtPayload = {
      email: storedToken.user.email,
      userId: storedToken.userId
    };

    return this.generateJwtTokens({ payload, ipAddress, userAgent });
  }

  private setAccessCookie(res: Response, value: string | null, expires?: Date) {
    const base = this.getCookieBaseOptions();
    res.cookie(AUTH_COOKIE.ACCESS, value ?? '', {
      ...base,
      sameSite: 'lax',
      path: '/',
      expires
    });
  }

  private setRefreshCookie(res: Response, value: string | null, expires?: Date) {
    const base = this.getCookieBaseOptions();
    res.cookie(AUTH_COOKIE.REFRESH, value ?? '', {
      ...base,
      sameSite: 'strict',
      path: '/auth/refresh',
      expires
    });
  }

  private getCookieBaseOptions(): CookieOptions {
    const { domain } = this.configService.getOrThrow<AppConfig>('app');
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      domain: isProduction ? domain : undefined
    };
  }
}
