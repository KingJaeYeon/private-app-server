import { Injectable } from '@nestjs/common';
import { ChannelHistoryDto } from '@/modules/channels/dto';

@Injectable()
export class ChannelHistoriesHelperService {
  /**
   * ChannelHistory 모델을 DTO로 변환
   */
  mapHistoryToDto(history: any): ChannelHistoryDto {
    return {
      id: history.id,
      channelId: history.channelId,
      videoCount: history.videoCount,
      viewCount: history.viewCount.toString(), // BigInt를 문자열로
      subscriberCount: history.subscriberCount,
      createdAt: history.createdAt
    };
  }
}

