import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import * as bcrypt from 'bcrypt';
import { User } from '@generated/prisma/client';
import { JwtService } from '@nestjs/jwt';
import { IJwtPayload } from '@/modules/auth/strategies/jwt.strategy';
import { add } from 'date-fns';
import type { Response } from 'express';
import { SignUpDto } from '@/modules/auth/dto';
import { AuthHelperService } from './auth-helper.service';
import { UsersService } from '@/modules/users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly db: PrismaService,
    private readonly helperService: AuthHelperService
  ) {}

  async validateUser(identifier: string, password: string): Promise<User> {
    const user = await this.usersService.getUser({ identifier });

    // OAuth User
    if (user.password === null) {
      throw new CustomException('INVALID_CREDENTIALS');
    }

    // TODO: 사용자 상태 검증 ( 휴먼계정, 블랙리스트 등등)
    // TODO: Email 인증 여부

    const authenticated = await bcrypt.compare(password, user.password);
    if (!authenticated) {
      throw new CustomException('INVALID_CREDENTIALS');
    }

    return user;
  }

  async verifyRefreshToken(refreshToken: string, userId: string) {}

  async signUp(dto: SignUpDto) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email }
    });

    if (user) {
      throw new CustomException('EMAIL_ALREADY_EXISTS');
    }

    const validCode = await this.db.verification.findFirst({
      where: {
        email: dto.email,
        type: 'EMAIL_VERIFICATION',
        expiredAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!validCode) {
      throw new CustomException('VERIFICATION_INVALID');
    }

    if (validCode.token !== dto.verifyCode) {
      throw new CustomException('VERIFICATION_INVALID');
    }

    return this.usersService.createUser({
      email: dto.email,
      password: dto.password,
      username: dto.email.split('@')[0],
      emailVerified: new Date()
    });
  }

  async generateJwtTokens({
    payload,
    ipAddress,
    userAgent
  }: {
    payload: IJwtPayload;
    userAgent: string;
    ipAddress: string;
  }) {
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = Math.random().toString(36).slice(2, 13);
    console.log('new:', refreshToken);
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
    this.helperService.setAccessCookie(res, null, expired);
    this.helperService.setRefreshCookie(res, null, expired);
  }

  async setSignInAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
    curRefreshToken?: string
  ) {
    const storedToken = await this.db.refreshToken.findFirst({
      where: { token: curRefreshToken },
      include: { user: true }
    });

    if (storedToken) {
      await this.db.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() }
      });
    }

    this.setAuthCookies(res, tokens);
  }

  setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    this.helperService.setAccessCookie(res, tokens.accessToken);
    this.helperService.setRefreshCookie(res, tokens.refreshToken);
  }

  async rotateRefreshToken(refreshToken: string, ipAddress: string, userAgent: string) {
    const storedToken = await this.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!storedToken) {
      throw new CustomException('INVALID_REFRESH_TOKEN');
    }

    const invalidToken = storedToken.revokedAt || storedToken.expiredAt < new Date();
    if (invalidToken) {
      await this.db.refreshToken
        .delete({
          where: { id: storedToken.id }
        })
        .then((r) => console.log('>> invalidToken:: delete', r.id));
      throw new CustomException('INVALID_REFRESH_TOKEN');
    }

    await this.db.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() }
    });

    const payload: IJwtPayload = {
      email: storedToken.user.email,
      userId: storedToken.userId
    };

    return await this.generateJwtTokens({ payload, ipAddress, userAgent });
  }
}
