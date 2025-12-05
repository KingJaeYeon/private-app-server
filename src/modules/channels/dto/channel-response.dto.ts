import { Channel, Tag } from '@generated/prisma/client';
import { IsNumber } from 'class-validator';

/**
 * BigInt 필드를 string으로 변환한 Channel 타입
 */
type ChannelWithStringViewCount = Omit<Channel, 'viewCount'> & {
  viewCount: string;
};

/**
 * 태그 정보 DTO (Prisma Tag 모델 기반)
 */
export class ChannelTagDto implements Pick<Tag, 'id' | 'name' | 'slug'> {
  /**
   * 태그 ID
   * @example 1
   */
  id: number;

  /**
   * 태그 이름
   * @example "개발"
   */
  name: string;

  /**
   * 태그 슬러그
   * @example "development"
   */
  slug: string;
}

/**
 * 구독 정보 응답 DTO
 */
export class SubscriptionResponseDto {
  /**
   * 구독 ID
   * @example 1
   */
  id: number;

  /**
   * 채널 정보
   */
  channel: ChannelResponseDto;

  /**
   * 연결된 태그들
   * @example [{ id: 1, name: "개발", slug: "development" }]
   */
  tags: ChannelTagDto[];

  /**
   * 구독 생성일
   * @example "2025-01-01T00:00:00.000Z"
   */
  createdAt: Date;

  /**
   * 구독 수정일
   * @example "2025-01-01T00:00:00.000Z"
   */
  updatedAt: Date;
}

/**
 * 채널 정보 응답 DTO (Prisma Channel 모델 기반, viewCount는 string으로 변환)
 */
export class ChannelResponseDto implements ChannelWithStringViewCount {
  /**
   * 채널 ID
   * @example 1
   */
  id: number;

  /**
   * YouTube 채널 ID
   * @example "UCxxxxxxxxxxxxx"
   */
  channelId: string;

  /**
   * 채널명
   * @example "슴슴도치"
   */
  name: string;

  /**
   * 채널 핸들
   * @example "@슴슴도치"
   */
  handle: string | null;

  /**
   * 채널 설명
   * @example "슴슴할때 보기좋은 꿀잼 유머"
   */
  description: string | null;

  /**
   * 채널 링크
   * @example "https://www.youtube.com/channel/UCxxxxxxxxxxxxx"
   */
  link: string;

  /**
   * 썸네일 URL
   * @example "https://yt3.ggpht.com/..."
   */
  thumbnailUrl: string | null;

  /**
   * 국가 코드
   * @example "KR"
   */
  regionCode: string | null;

  /**
   * 기본 언어
   * @example "ko"
   */
  defaultLanguage: string | null;

  /**
   * 영상 수
   * @example 410
   */
  videoCount: number;

  /**
   * 총 조회수 (BigInt를 string으로 변환)
   * @example "708661464"
   */
  viewCount: string;

  /**
   * 구독자 수
   * @example 57200
   */
  subscriberCount: number;

  /**
   * 채널 개설일
   * @example "2020-08-16T07:07:53.460Z"
   */
  publishedAt: Date;

  /**
   * 마지막 영상 업로드일
   * @example "2025-01-01T00:00:00.000Z"
   */
  lastVideoUploadedAt: Date | null;

  /**
   * 생성일
   * @example "2025-01-01T00:00:00.000Z"
   */
  createdAt: Date;

  /**
   * 수정일
   * @example "2025-01-01T00:00:00.000Z"
   */
  updatedAt: Date;
}
