import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { ApiKeyType } from '@generated/prisma/client';

const MAX_DAILY_USAGE = 10000;
const MAX_USER_DAILY_USAGE = 1000; // 유저별 일일 사용량 제한

@Injectable()
export class YoutubeApiKeyService {
  constructor(private readonly db: PrismaService) {}

  // ==================== 유저 API 키 ====================

  /**
   * 유저 API 키 조회
   */
  async getUserApiKey(userId: string) {
    const userKey = await this.db.apiKey.findUnique({
      where: {
        userId_type: {
          userId,
          type: ApiKeyType.USER
        },
        isActive: true
      }
    });

    if (!userKey) {
      throw new CustomException('YOUTUBE_API_KEY_NOT_FOUND');
    }

    return {
      id: userKey.id,
      apiKey: userKey.apiKey
    };
  }

  // ==================== 초기화 ====================

  /**
   * 일일 사용량 초기화 (16:00에 실행)
   */
  async resetDailyUsage(): Promise<{ userCount: number; serverCount: number }> {
    const [userResult, serverResult] = await Promise.all([
      // 유저 API 키 초기화
      this.db.apiKey.updateMany({
        where: { type: ApiKeyType.USER },
        data: { usage: 0 }
      }),
      // 서버 API 키 초기화
      this.db.apiKey.updateMany({
        where: { type: ApiKeyType.SERVER },
        data: { usage: 0 }
      })
    ]);

    // 유저별 사용량은 날짜 기반이므로 자동으로 새 날짜에 새 레코드 생성됨
    // 오래된 레코드는 정리 필요 (선택사항)

    return {
      userCount: userResult.count,
      serverCount: serverResult.count
    };
  }

  /**
   * 서버 API 키 조회 (사용량이 가장 적은 활성 키 반환)
   */
  async getServerApiKey() {
    const serverKey = await this.db.apiKey.findFirst({
      where: {
        type: ApiKeyType.SERVER,
        isActive: true
      },
      orderBy: {
        usage: 'asc' // 사용량 적은 순
      }
    });

    if (!serverKey) {
      throw new CustomException('YOUTUBE_API_KEY_NOT_FOUND');
    }

    return {
      id: serverKey.id,
      apiKey: serverKey.apiKey
    };
  }

  /**
   * 유저가 서버 API 키 사용 (트랜잭션으로 안전하게 처리)
   */
  async useServerApiKey(userId: string, amount: number): Promise<string> {
    return this.db.$transaction(async (tx) => {
      // 1. 서버 키 선택 (사용량 가장 낮은 활성 키)
      const serverKey = await tx.apiKey.findFirst({
        where: {
          type: ApiKeyType.SERVER,
          isActive: true
        },
        orderBy: {
          usage: 'asc'
        }
      });

      if (!serverKey) {
        throw new CustomException('YOUTUBE_API_KEY_NOT_FOUND');
      }

      // 서버 키 전체 사용량 체크
      if (serverKey.usage + amount > MAX_DAILY_USAGE) {
        throw new CustomException('YOUTUBE_API_QUOTA_EXCEEDED', {
          usage: serverKey.usage,
          maxUsage: MAX_DAILY_USAGE
        });
      }

      // 2. 유저별 일일 사용량 체크
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 날짜만 (시간 제외)

      const userUsage = await tx.serverApiKeyUsage.findUnique({
        where: {
          userId_apiKeyId_date: {
            userId,
            apiKeyId: serverKey.id,
            date: today
          }
        }
      });

      // 유저별 일일 사용량 체크 (악성 유저 방지)
      if (userUsage && userUsage.usage + amount > MAX_USER_DAILY_USAGE) {
        throw new CustomException('USER_API_QUOTA_EXCEEDED', {
          usage: userUsage.usage,
          maxUsage: MAX_USER_DAILY_USAGE
        });
      }

      // 3. 원자적 증가
      await Promise.all([
        // 서버 키 전체 사용량 증가
        tx.apiKey.update({
          where: { id: serverKey.id },
          data: { usage: { increment: amount } }
        }),
        // 유저별 사용량 증가
        tx.serverApiKeyUsage.upsert({
          where: {
            userId_apiKeyId_date: {
              userId,
              apiKeyId: serverKey.id,
              date: today
            }
          },
          create: {
            userId,
            apiKeyId: serverKey.id,
            date: today,
            usage: amount
          },
          update: {
            usage: { increment: amount }
          }
        })
      ]);

      return serverKey.apiKey;
    });
  }

  /**
   * 유저 일일 쿼터 체크
   */
  async checkUserDailyQuota(userId: string, requestedQuota: number, dailyLimit: number = 10000) {
    const todayUsage = await this.getUserTodayUsage(userId);

    if (todayUsage + requestedQuota > dailyLimit) {
      throw new CustomException('USER_DAILY_QUOTA_EXCEEDED', {
        usage: todayUsage,
        limit: dailyLimit,
        requested: requestedQuota
      });
    }

    return { usage: todayUsage, remaining: dailyLimit - todayUsage };
  }

  /**
   * 유저의 오늘 사용량 조회
   */
  async getUserTodayUsage(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.db.serverApiKeyUsage.aggregate({
      where: {
        userId,
        date: today
      },
      _sum: {
        usage: true
      }
    });

    return result._sum.usage || 0;
  }
}
