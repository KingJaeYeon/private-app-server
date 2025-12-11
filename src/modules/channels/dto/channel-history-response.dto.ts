import { ChannelHistory } from '@generated/prisma/client';

/** BigInt 필드를 string으로 변환한 ChannelHistory 타입 */
type ChannelHistoryWithStringViewCount = Omit<ChannelHistory, 'viewCount'> & {
  viewCount: string;
};

/** 채널 히스토리 응답 DTO (Prisma ChannelHistory 모델 기반, viewCount는 string으로 변환) */
export class ChannelHistoryResponseDto implements ChannelHistoryWithStringViewCount {
  /** 히스토리 ID @example 1*/
  id: number;
  /** 채널 ID @example 1*/
  channelId: number;
  /** 영상 수 @example 410*/
  videoCount: number;
  /** 총 조회수 (BigInt를 string으로 변환) @example "708661464"*/
  viewCount: string;
  /** 구독자 수 @example 57200*/
  subscriberCount: number;
  /** 기록 생성일 @example "2025-01-01T00:00:00.000Z"*/
  createdAt: Date;
}
