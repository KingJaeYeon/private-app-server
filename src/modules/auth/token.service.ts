import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IConfigKey, IJWTConfig } from '@/config/config.interface';
import * as crypto from 'crypto';
import { add } from 'date-fns';
import { TokenMetadata, TokenPair } from '@/common/interface/jwt.interface';
import { CustomException } from '@/common/exceptions';

@Injectable()
export class TokenService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService<IConfigKey>,
    private readonly jwt: JwtService
  ) {}

  async generateTokenPair(userId: string, metadata: TokenMetadata) {
    const config: IJWTConfig = this.config.getOrThrow('jwt');
    const accessToken = this.jwt.sign(
      { userId },
      {
        expiresIn: config.access.expiresIn,
        secret: config.access.secret
      }
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');

    // DB 저장
    await this.db.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiredAt: add(new Date(), { days: 7 }),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
      }
    });

    return { accessToken, refreshToken, userId };
  }

  async rotateRefreshToken(refreshToken: string, metadata: TokenMetadata) {
    const stored = await this.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!stored) {
      throw new CustomException('INVALID_REFRESH_TOKEN');
    }

    if (stored.revokedAt || stored.expiredAt < new Date()) {
      await this.db.refreshToken.delete({ where: { id: stored.id } });
      throw new CustomException('INVALID_REFRESH_TOKEN');
    }

    await this.db.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() }
    });

    return await this.generateTokenPair(stored.userId, metadata);
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const stored = await this.db.refreshToken.findUnique({
      where: { token: refreshToken }
    });

    if (stored) {
      await this.db.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() }
      });
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
}
