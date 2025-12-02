import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/core/prisma.service';
import { Request } from 'express';
import { CHECK_BLACKLIST_KEY } from '@/common/decorators';
import { CustomException } from '@/common/exceptions';

@Injectable()
export class BlacklistGuard implements CanActivate {
  // 인메모리 캐시
  private cache = new Map<string, number>(); // ip -> expiresAt timestamp
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5분 캐시

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 데코레이터가 있는지 확인
    const shouldCheck = this.reflector.getAllAndOverride<boolean>(CHECK_BLACKLIST_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!shouldCheck) {
      return true;
    }

    // 2. IP 추출
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.extractIp(request);

    // 3. 블랙리스트 체크 (캐싱 포함)
    const isBlacklisted = await this.isBlacklisted(ip);

    if (isBlacklisted) {
      throw new CustomException('BLACKLIST_IP');
    }

    return true;
  }
  /**
   * 블랙리스트 체크 (캐시 + DB)
   */
  private async isBlacklisted(ip: string): Promise<boolean> {
    // 1. 캐시 확인
    const cachedExpiry = this.cache.get(ip);
    if (cachedExpiry !== undefined) {
      const now = Date.now();
      if (now < cachedExpiry) {
        return true; // 캐시된 블랙리스트
      }
      // 만료된 캐시 삭제
      this.cache.delete(ip);
    }

    // 2. DB 조회 (캐시 미스)
    const blacklisted = await this.prisma.blacklist.findFirst({
      where: {
        ip,
        OR: [
          { expiresAt: null }, // 영구 차단
          { expiresAt: { gt: new Date() } } // 아직 만료 안 됨
        ]
      }
    });

    if (blacklisted) {
      // 캐시에 저장 (expiresAt이 있으면 그 시간까지, 없으면 5분)
      const expiry = blacklisted.expiresAt ? blacklisted.expiresAt.getTime() : Date.now() + this.CACHE_TTL;

      this.cache.set(ip, expiry);
      return true;
    }

    return false;
  }

  /**
   * IP 추출 (프록시 고려)
   */
  private extractIp(request: Request): string {
    // x-forwarded-for 헤더 (프록시/로드밸런서 뒤에 있을 때)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
      return ip;
    }

    // x-real-ip 헤더 (일부 프록시 사용)
    const realIp = request.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
      return realIp;
    }

    // 직접 연결
    return request.socket.remoteAddress || 'unknown';
  }

  /**
   * 주기적으로 만료된 캐시 정리 (선택사항)
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [ip, expiry] of this.cache.entries()) {
      if (now >= expiry) {
        this.cache.delete(ip);
      }
    }
  }
}
