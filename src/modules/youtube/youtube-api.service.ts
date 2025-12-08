// ==================== youtube-api.service.ts ====================
// YouTube API 호출만 담당하는 순수 서비스
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { CustomException } from '@/common/exceptions';
import {
  IApiResponse,
  IChannelStats,
  IFetchPlaylistItemDetails,
  IFetchPlaylistItems,
  IFetchSearchVideo,
  IYouTubeChannelData,
  IYouTubeChannelRequest,
  IYouTubeVideoData,
  IYouTubeVideoRequest
} from '@/modules/youtube/youtube.interface';
import { PrismaService } from '@/core/prisma.service';

@Injectable()
export class YoutubeApiService {
  private readonly logger = new Logger(YoutubeApiService.name);
  private readonly api: AxiosInstance;
  private readonly BATCH_SIZE = 50; // YouTube API 최대 허용 개수

  constructor(private readonly db: PrismaService) {
    this.api = axios.create({
      baseURL: 'https://www.googleapis.com/youtube/v3',
      headers: { 'Content-Type': 'application/json' }
    });

    // 에러 인터셉터
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || 'Unknown error';

        this.logger.error(`YouTube API Error [${status}]: ${message}`);

        if (status === 401 || status === 403) {
          throw new CustomException('YOUTUBE_API_ERROR', {
            apiMsg: 'API 키가 유효하지 않거나 권한이 없습니다',
            message,
            status
          });
        }
        if (status === 429) {
          throw new CustomException('YOUTUBE_API_QUOTA_EXCEEDED');
        }
        throw new CustomException('YOUTUBE_API_ERROR', { message, status });
      }
    );
  }

  /**
   * Channels.list - 채널 정보 조회 (최대 50개, 자동 배치 처리)
   * @note id와 forHandle 중 하나만 사용 가능
   * @param params
   */
  async fetchChannelsBatch(params: IYouTubeChannelRequest): Promise<IApiResponse<IYouTubeChannelData>> {
    const { apiKey, ids, handles, userId, apiKeyId } = params;

    if (ids && handles) {
      throw new CustomException('YOUTUBE_API_ERROR', { message: `ids와 handles 중 하나만 사용할 수 있습니다.` });
    }

    const targetArray = ids || handles || [];
    if (targetArray.length === 0) return { items: [], usedQuota: 0 };

    const allItems: IYouTubeChannelData[] = [];
    const chunks = this.chunk(targetArray, this.BATCH_SIZE);
    const usedQuota = chunks.length;

    for (const chunk of chunks) {
      const { data } = await this.api.get('channels', {
        params: {
          key: apiKey,
          part: 'snippet,statistics,contentDetails',
          ...(ids && { id: chunk.join(',') }),
          ...(handles && { forHandle: chunk.join(',') })
        }
      });

      const items = data?.items ?? [];
      allItems.push(...items);

      this.logger.debug(`채널 조회: ${items.length}/${chunk.length}개`);
    }
    await this.updateApiKeyUsage(apiKeyId, userId, usedQuota);

    return { items: allItems, usedQuota };
  }

  /**
   * PlaylistItems.list - 플레이리스트(최신순으로 동영상 정보) 항목 조회 (maxResult: 최대 50)
   * @note 단일 플레이리스트만 조회 가능 (페이지네이션 지원)
   * @todo publishedAfter 매개변수 추가해야함
   */
  async fetchPlaylistItems(params: IFetchPlaylistItemDetails) {
    const { apiKey, upload, pageToken, apiKeyId, userId } = params;

    try {
      const { data } = await this.api.get('playlistItems', {
        params: {
          key: apiKey,
          part: 'snippet,contentDetails',
          playlistId: upload,
          maxResults: 50, // 최대 50개
          ...(pageToken && { pageToken })
        }
      });
      await this.updateApiKeyUsage(apiKeyId, userId, 1);
      return {
        items: data?.items ?? [],
        nextPageToken: data?.nextPageToken,
        totalResults: data?.pageInfo?.totalResults ?? 0,
        usedQuota: 1
      };
    } catch (error) {
      if (error?.response?.status === 404) {
        return { items: [], nextPageToken: undefined, totalResults: 0, usedQuota: 1 };
      }
      throw new CustomException('YOUTUBE_API_ERROR');
    }
  }

  /**
   * PlaylistItems.list - 플레이리스트 항목 조회
   * @note 단일 플레이리스트만 조회 후 최신 영상 하나 get
   */
  async fetchLastVideoUploadedAt(params: IFetchPlaylistItems) {
    const { apiKey, upload, apiKeyId, userId } = params;

    const { data } = await this.api.get('playlistItems', {
      params: {
        key: apiKey,
        part: 'snippet,contentDetails',
        playlistId: upload,
        maxResults: 1
      }
    });
    await this.updateApiKeyUsage(apiKeyId, userId, 1);

    const lastVideoUploadedAt = data?.items?.[0]?.snippet?.publishedAt;

    return { lastVideoUploadedAt, usedQuota: 1 };
  }

  /**
   * Videos.list - 비디오 상세 정보 조회 (최대 50개, 자동 배치 처리)
   * Search video 로 videoIds 수집 후 해당 video 들의 상세 정보를 가져와야하고 이때 사용하는 메서드
   * @param params
   */
  async fetchVideosBatch(params: IYouTubeVideoRequest): Promise<IApiResponse<IYouTubeVideoData>> {
    const { apiKey, videoIds, apiKeyId, userId } = params;
    if (videoIds.length === 0) return { items: [], usedQuota: 0 };

    const allItems: IYouTubeVideoData[] = [];
    const chunks = this.chunk(videoIds, this.BATCH_SIZE);
    let usedQuota = chunks.length;

    for (const chunk of chunks) {
      const { data } = await this.api.get('videos', {
        params: {
          key: apiKey,
          part: 'id,snippet,contentDetails,statistics',
          id: chunk.join(',')
        }
      });
      usedQuota += 1;
      const items = data?.items ?? [];
      allItems.push(...items);

      this.logger.debug(`비디오 조회: ${items.length}/${chunk.length}개`);
    }
    await this.updateApiKeyUsage(apiKeyId, userId, usedQuota);

    return { items: allItems, usedQuota };
  }

  /**
   * Search.list - 키워드 검색 (쿼터 100 소모, 페이지네이션)
   * @note maxResults는 한 페이지당 결과 수 (최대 50) youtube-helper.service isoAfterNDays 사용
   */
  async searchVideos(params: IFetchSearchVideo) {
    const {
      apiKey,
      keyword,
      videoDuration,
      pageToken,
      regionCode,
      relevanceLanguage,
      publishedAfter,
      apiKeyId,
      userId
    } = params;

    const { data } = await this.api.get('search', {
      params: {
        key: apiKey,
        part: 'id',
        type: 'video',
        q: keyword,
        order: 'viewCount',
        maxResults: 50,
        videoDuration,
        publishedAfter,
        ...(regionCode && { regionCode }),
        ...(relevanceLanguage && { relevanceLanguage }),
        ...(pageToken && { pageToken })
      }
    });

    await this.updateApiKeyUsage(apiKeyId, userId, 100);

    return {
      videoIds: (data?.items ?? []).map((item: any) => item?.id?.videoId).filter(Boolean),
      nextPageToken: data?.nextPageToken,
      usedQuota: 100
    };
  }

  private async updateApiKeyUsage(apiKeyId: number, userId: string | undefined, quota: number) {
    if (quota === 0) return;

    try {
      // 1. API 키 전체 사용량 증가
      await this.db.apiKey.update({
        where: { id: apiKeyId },
        data: { usage: { increment: quota } }
      });

      // 2. 서버 키이고 userId가 있으면 유저별 사용량 추적
      if (userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await this.db.serverApiKeyUsage.upsert({
          where: { userId_apiKeyId_date: { userId, apiKeyId, date: today } },
          create: { userId, apiKeyId, date: today, usage: quota },
          update: { usage: { increment: quota } }
        });
      }

      this.logger.debug(`쿼터 사용: ${quota} (API Key ID: ${apiKeyId}, User: ${userId || 'N/A'})`);
    } catch (error) {
      this.logger.error('쿼터 업데이트 실패:', error);
    }
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const isEmptyArray = !Array.isArray(array) || array.length === 0;
    const isInvalidSize = !Number.isInteger(size) || size <= 0;

    if (isEmptyArray) return [];

    if (isInvalidSize)
      throw new CustomException(`YOUTUBE_API_ERROR`, {
        message: 'chunk size must be a positive integer. Received: ${size}'
      });

    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 채널 맵 생성
   */
  private buildChannelMap(channels: any[]): Map<string, IChannelStats> {
    return new Map(
      channels.map((ch) => [
        ch.channelId,
        {
          handle: ch.handle,
          subscriberCount: ch.subscriberCount,
          videoCount: ch.videoCount,
          viewCount: ch.viewCount.toString(),
          regionCode: ch.regionCode,
          link: ch.link,
          publishedAt: ch.publishedAt,
          thumbnailUrl: ch.thumbnailUrl
        }
      ])
    );
  }
}
