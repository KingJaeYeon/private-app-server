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
   * 사용자 API 키 조회 (사용량 체크 포함)
   */
  async getUserApiKey(userId: string): Promise<{ apiKey: string; usage: number } | null> {
    const userApiKey = await this.db.apiKey.findUnique({
      where: {
        userId_type: {
          userId,
          type: ApiKeyType.USER
        }
      },
      select: { apiKey: true, usage: true }
    });

    if (!userApiKey) {
      return null;
    }

    // 사용량이 초과되었는지 체크
    if (userApiKey.usage >= MAX_DAILY_USAGE) {
      throw new CustomException('YOUTUBE_API_QUOTA_EXCEEDED', {
        usage: userApiKey.usage,
        maxUsage: MAX_DAILY_USAGE
      });
    }

    return userApiKey;
  }

  /**
   * 사용자 API 키 등록/업데이트
   */
  async upsertUserApiKey(userId: string, apiKey: string): Promise<{ apiKey: string; usage: number }> {
    // API 키 유효성 검사
    if (!apiKey || apiKey.trim().length === 0) {
      throw new CustomException('INVALID_API_KEY');
    }

    const result = await this.db.apiKey.upsert({
      where: {
        userId_type: {
          userId,
          type: ApiKeyType.USER
        }
      },
      create: {
        type: ApiKeyType.USER,
        userId,
        apiKey: apiKey.trim(),
        usage: 0
      },
      update: {
        apiKey: apiKey.trim()
      },
      select: {
        apiKey: true,
        usage: true
      }
    });

    return result;
  }

  /**
   * 사용자 API 키 삭제
   */
  async deleteUserApiKey(userId: string): Promise<void> {
    await this.db.apiKey
      .delete({
        where: {
          userId_type: {
            userId,
            type: ApiKeyType.USER
          }
        }
      })
      .catch(() => {
        // 이미 삭제되었거나 없는 경우 무시
      });
  }

  /**
   * 유저 API 키 사용량 증가 (키워드 검색용)
   */
  async incrementUserUsage(userId: string, amount: number = 1): Promise<void> {
    await this.db.apiKey.update({
      where: {
        userId_type: {
          userId,
          type: ApiKeyType.USER
        }
      },
      data: {
        usage: { increment: amount }
      }
    });
  }

  /**
   * 유저 API 키 사용량 조회
   */
  async getUserUsage(userId: string): Promise<{ usage: number; maxUsage: number }> {
    const userApiKey = await this.db.apiKey.findUnique({
      where: {
        userId_type: {
          userId,
          type: ApiKeyType.USER
        }
      },
      select: { usage: true }
    });

    if (!userApiKey) {
      throw new CustomException('YOUTUBE_API_KEY_NOT_FOUND');
    }

    return {
      usage: userApiKey.usage,
      maxUsage: MAX_DAILY_USAGE
    };
  }

  // ==================== 서버 API 키 ====================

  /**
   * 서버 API 키 조회 (사용량 가장 낮은 활성 키)
   */
  async getServerApiKey(): Promise<{ id: number; apiKey: string; usage: number }> {
    const serverKey = await this.db.apiKey.findFirst({
      where: {
        type: ApiKeyType.SERVER,
        isActive: true
      },
      orderBy: {
        usage: 'asc'
      },
      select: {
        id: true,
        apiKey: true,
        usage: true
      }
    });

    if (!serverKey) {
      throw new CustomException('YOUTUBE_API_KEY_NOT_FOUND');
    }

    // 서버 키 전체 사용량 체크
    if (serverKey.usage >= MAX_DAILY_USAGE) {
      throw new CustomException('YOUTUBE_API_QUOTA_EXCEEDED', {
        usage: serverKey.usage,
        maxUsage: MAX_DAILY_USAGE
      });
    }

    return serverKey;
  }

  /**
   * 유저가 서버 API 키 사용 (트랜잭션으로 안전하게 처리)
   */
  async useServerApiKey(userId: string, amount: number): Promise<string> {
    return await this.db.$transaction(async (tx) => {
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
   * 서버 API 키 등록/업데이트
   */
  async upsertServerApiKey(apiKey: string, name: string): Promise<{ apiKey: string; usage: number }> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new CustomException('INVALID_API_KEY');
    }

    if (!name || name.trim().length === 0) {
      throw new CustomException('BAD_REQUEST', { message: '서버 API 키 이름은 필수입니다' });
    }

    const result = await this.db.apiKey.upsert({
      where: {
        type_name: {
          type: ApiKeyType.SERVER,
          name: name.trim()
        }
      },
      create: {
        type: ApiKeyType.SERVER,
        apiKey: apiKey.trim(),
        name: name.trim(),
        usage: 0
      },
      update: {
        apiKey: apiKey.trim()
      },
      select: {
        apiKey: true,
        usage: true
      }
    });

    return result;
  }

  /**
   * 서버 API 키 사용량 조회
   */
  async getServerUsage(): Promise<Array<{ name: string | null; usage: number; maxUsage: number }>> {
    const serverKeys = await this.db.apiKey.findMany({
      where: {
        type: ApiKeyType.SERVER,
        isActive: true
      },
      select: {
        name: true,
        usage: true
      }
    });

    return serverKeys.map((key) => ({
      name: key.name,
      usage: key.usage,
      maxUsage: MAX_DAILY_USAGE
    }));
  }

  /**
   * 유저별 서버 API 키 사용량 조회
   */
  async getUserServerUsage(userId: string): Promise<{ usage: number; maxUsage: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await this.db.serverApiKeyUsage.findFirst({
      where: {
        userId,
        date: today
      },
      select: {
        usage: true
      },
      orderBy: {
        usage: 'desc'
      }
    });

    return {
      usage: usage?.usage || 0,
      maxUsage: MAX_USER_DAILY_USAGE
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
}

