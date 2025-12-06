import { SetMetadata } from '@nestjs/common';

export const USE_YOUTUBE_API_KEY = 'USE_YOUTUBE_API';

/**
 * YouTube API 사용량 추적 데코레이터
 * @param quota API 호출 시 소모되는 쿼터 (기본값: 1)
 * @example
 * @UseYoutubeApi(1) // Videos API, Channels API 등
 * @UseYoutubeApi(100) // Search API
 */
export const UseYoutubeApi = (quota: number = 1) => SetMetadata(USE_YOUTUBE_API_KEY, quota);

