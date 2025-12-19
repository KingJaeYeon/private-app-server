import { Injectable, Logger } from '@nestjs/common';
import { Cron, Timeout } from '@nestjs/schedule';
import { YoutubeApiKeyService } from './youtube-api-key.service';
import { PrismaService } from '@/core/prisma.service';
import { YoutubeApiService } from '@/modules/youtube/youtube-api.service';
import { ChannelHistory } from '@generated/prisma/client';

/**
 * YouTube API 키 사용량 초기화 스케줄러
 * 매일 16:00에 모든 사용자의 일일 사용량을 초기화
 */
@Injectable()
export class YoutubeSchedulerService {
  private readonly logger = new Logger(YoutubeSchedulerService.name);

  constructor(
    private readonly apiKeyService: YoutubeApiKeyService,
    private readonly db: PrismaService,
    private readonly api: YoutubeApiService
  ) {}

  /**
   * 매일 16:00에 실행 (한국 시간 기준)
   * Cron 표현식: '0 0 16 * * *' (매일 16시 0분)
   */
  @Cron('0 0 16 * * *', {
    name: 'reset-youtube-api-usage',
    timeZone: 'Asia/Seoul'
  })
  async handleResetDailyUsage() {
    this.logger.log('🔄 YouTube API 사용량 초기화 시작...');

    try {
      const result = await this.apiKeyService.resetDailyUsage();
      this.logger.log(`✅ YouTube API 사용량 초기화 완료: 유저 ${result.userCount}개, 서버 ${result.serverCount}개`);
    } catch (error) {
      this.logger.error('❌ YouTube API 사용량 초기화 실패', error);
    }
  }

  /**
   * 당일 업데이트 안된 채널 데이터 갱신 (Cron)
   * Cron 표현식: '0 5 16 * * *' (매일 16시 5분)
   */
  @Cron('0 5 16 * * *', {
    name: 'youtube-history',
    timeZone: 'Asia/Seoul'
  })
  // @Timeout(0)
  async updateAllChannelsFromYouTube() {
    this.logger.log('🔄 채널 데이터 갱신 스케줄러 시작');

    try {
      // 1. 당일 갱신되지 않은 채널 조회
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const channels = await this.db.channel.findMany({
        where: { updatedAt: { lt: today } },
        select: {
          id: true,
          channelId: true,
          videoCount: true,
          lastVideoUploadedAt: true,
          viewCount: true,
          subscriberCount: true,
          handle: true
        }
      });

      if (channels.length === 0) {
        this.logger.log('✅ 갱신할 채널 없음');
        return;
      }

      this.logger.log(`📊 갱신 대상: ${channels.length}개 채널`);

      // 2. API 호출 (최대 50개씩 자동 배치)
      const serverKey = await this.apiKeyService.getServerApiKey();
      const { items: allItems } = await this.api.fetchChannelsBatch({
        apiKey: serverKey.apiKey,
        apiKeyId: serverKey.id,
        ids: channels.map((c) => c.channelId)
      });

      this.logger.log(`✅ API 응답: ${allItems.length}개 채널`);

      // 3. 데이터 변환 및 업데이트
      const now = new Date();
      const historyData: Omit<ChannelHistory, 'id' | 'createdAt'>[] = [];

      const channelMap = new Map(channels.map(({ channelId, ...others }) => [channelId, others]));

      for (const item of allItems) {
        const existingChannel = channelMap.get(item.id);
        if (!existingChannel) continue;

        const videoCount = parseInt(item.statistics.videoCount);
        const viewCount = BigInt(item.statistics.viewCount || 0);
        const subscriberCount = parseInt(item.statistics.subscriberCount);
        let lastVideoUploadedAt = existingChannel.lastVideoUploadedAt;

        if (existingChannel.videoCount !== videoCount) {
          const uploadPlaylistId = item.contentDetails?.relatedPlaylists?.uploads!;
          const lastVideo = await this.api.fetchLastVideoUploadedAt({
            apiKey: serverKey.apiKey,
            apiKeyId: serverKey.id,
            upload: uploadPlaylistId
          });
          lastVideoUploadedAt = lastVideo.lastVideoUploadedAt;
        }

        // 채널 업데이트
        await this.db.channel.update({
          where: { channelId: item.id },
          data: {
            name: item.snippet.title,
            thumbnailUrl: item.snippet.thumbnails?.default?.url,
            videoCount,
            viewCount,
            subscriberCount,
            lastVideoUploadedAt,
            updatedAt: now
          }
        });

        // 히스토리 데이터 수집 (channelId는 Channel의 id 필드 사용)
        historyData.push({
          channelId: existingChannel.id,
          videoCount,
          viewCount,
          subscriberCount
        });
      }

      if (historyData.length > 0) {
        await this.db.channelHistory.createMany({ data: historyData });
        this.logger.log(`📊 히스토리 저장: ${historyData.length}개`);
      }

      this.logger.log('✅ 채널 데이터 갱신 완료');
    } catch (error) {
      this.logger.error(`❌ 채널 데이터 갱신 실패 :${error}`);
    }
  }

  @Cron('0 2 * * *')
  async updateDailyViewCounts() {
    this.logger.log('일일 조회수 업데이트 시작');

    try {
      // 모든 채널 ID 조회
      const channels = await this.db.channel.findMany({
        select: { id: true }
      });

      const channelIds = channels.map((c) => c.id);

      // 배치로 일일 조회수 계산
      const dailyViewsMap = await this.calculateDailyViewsBatch(channelIds);

      // 한 번에 업데이트 (트랜잭션)
      await this.db.$transaction(
        Array.from(dailyViewsMap.entries()).map(([channelId, dailyViews]) =>
          this.db.channel.update({
            where: { id: channelId },
            data: { dailyViewCount: dailyViews }
          })
        )
      );

      this.logger.log(`일일 조회수 업데이트 완료: ${channelIds.length}개 채널`);
    } catch (error) {
      this.logger.error('일일 조회수 업데이트 실패', error);
    }
  }
  /**
   * 여러 채널의 일일 조회수 한 번에 계산
   */
  async calculateDailyViewsBatch(channelIds: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>();

    // 각 채널의 최근 2개 히스토리 조회
    const histories = await this.db.channelHistory.findMany({
      where: { channelId: { in: channelIds } },
      orderBy: { createdAt: 'desc' },
      take: channelIds.length * 2
    });

    // 채널별로 그룹화
    const grouped = new Map<number, typeof histories>();
    histories.forEach((h) => {
      if (!grouped.has(h.channelId)) {
        grouped.set(h.channelId, []);
      }
      grouped.get(h.channelId)!.push(h);
    });

    // 각 채널의 일일 조회수 계산
    grouped.forEach((records, channelId) => {
      if (records.length >= 2) {
        const [today, yesterday] = records;
        const diff = Number(today.viewCount - yesterday.viewCount);
        result.set(channelId, diff > 0 ? diff : 0);
      } else {
        result.set(channelId, 0);
      }
    });

    return result;
  }
}
