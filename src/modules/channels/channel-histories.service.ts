import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { ChannelHistoryDto } from '@/modules/channels/dto';
import { ChannelHistoriesHelperService } from './channel-histories-helper.service';

@Injectable()
export class ChannelHistoriesService {
  constructor(
    private readonly db: PrismaService,
    private readonly helperService: ChannelHistoriesHelperService
  ) {}

  /**
   * 채널 히스토리 조회 (시간순 정렬)
   */
  async getChannelHistories(channelId: number): Promise<ChannelHistoryDto[]> {
    // 채널 존재 확인
    const channel = await this.db.channel.findUnique({
      where: { id: channelId }
    });

    if (!channel) {
      throw new CustomException('CHANNEL_NOT_FOUND', { channelId });
    }

    // 히스토리 조회 (시간순 정렬)
    const histories = await this.db.channelHistory.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' }
    });

    return histories.map((history) => this.helperService.mapHistoryToDto(history));
  }

  /**
   * 채널 히스토리 저장
   * TODO: YouTube API 호출하여 채널 통계 정보를 가져와서 저장
   * Cron 작업으로 주기적으로 실행 예정
   */
  async saveChannelHistory(channelId: number): Promise<ChannelHistoryDto> {
    // 채널 존재 확인 및 최신 정보 가져오기
    const channel = await this.db.channel.findUnique({
      where: { id: channelId }
    });

    if (!channel) {
      throw new CustomException('CHANNEL_NOT_FOUND', { channelId });
    }

    // 히스토리 저장
    const history = await this.db.channelHistory.create({
      data: {
        channelId,
        videoCount: channel.videoCount,
        viewCount: channel.viewCount,
        subscriberCount: channel.subscriberCount
      }
    });

    return this.helperService.mapHistoryToDto(history);
  }

  /**
   * 여러 채널 히스토리 일괄 저장
   * Cron 작업에서 사용
   */
  async saveMultipleChannelHistories(channelIds: number[]): Promise<ChannelHistoryDto[]> {
    // 채널 정보 일괄 조회
    const channels = await this.db.channel.findMany({
      where: { id: { in: channelIds } },
      select: {
        id: true,
        videoCount: true,
        viewCount: true,
        subscriberCount: true
      }
    });

    if (channels.length === 0) {
      return [];
    }

    // 히스토리 일괄 생성
    const histories = await this.db.channelHistory.createMany({
      data: channels.map((channel) => ({
        channelId: channel.id,
        videoCount: channel.videoCount,
        viewCount: channel.viewCount,
        subscriberCount: channel.subscriberCount
      }))
    });

    // 생성된 히스토리 조회 (ID는 createMany에서 반환하지 않으므로 별도 조회)
    const createdHistories = await this.db.channelHistory.findMany({
      where: {
        channelId: { in: channelIds },
        createdAt: {
          gte: new Date(Date.now() - 1000) // 방금 생성된 것들
        }
      },
      orderBy: { createdAt: 'desc' },
      take: channels.length
    });

    return createdHistories.map((history) => this.helperService.mapHistoryToDto(history));
  }
}
