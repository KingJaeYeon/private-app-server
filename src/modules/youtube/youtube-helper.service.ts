import { Injectable, Logger } from '@nestjs/common';
import { CustomException } from '@/common/exceptions';
import axios, { AxiosInstance } from 'axios';
import { differenceInHours, parseISO, subDays } from 'date-fns';
import { IYouTubeVideoData } from './youtube.interface';
import { YoutubeApiKeyService } from './youtube-api-key.service';

@Injectable()
export class YoutubeHelperService {
  private readonly logger = new Logger(YoutubeHelperService.name);
  private readonly youtubeApi: AxiosInstance;

  constructor(private readonly apiKeyService: YoutubeApiKeyService) {
    this.youtubeApi = axios.create({
      baseURL: 'https://www.googleapis.com/youtube/v3',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 에러 인터셉터
    this.youtubeApi.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error('YouTube API 요청 실패', error.response?.data || error.message);

        const message = error.response?.data?.error?.message || error.message || 'Unknown error';
        const status = error.response?.status;

        // HTTP 상태 코드에 따라 다른 에러 코드
        if (status === 403 || status === 401) {
          return Promise.reject(
            new CustomException('YOUTUBE_API_ERROR', {
              message: 'API 키가 유효하지 않거나 권한이 없습니다',
              originalError: message,
              status
            })
          );
        }

        if (status === 429) {
          return Promise.reject(
            new CustomException('YOUTUBE_API_QUOTA_EXCEEDED', {
              message: 'API 쿼터를 초과했습니다',
              status
            })
          );
        }

        // 기타 에러
        return Promise.reject(
          new CustomException('YOUTUBE_API_ERROR', {
            message,
            status
          })
        );
      }
    );
  }

  /**
   * 마지막 영상 업로드일 조회
   */
  async fetchLastPublishedAt(apiKey: string, uploadPlaylistId?: string): Promise<Date | null> {
    if (!uploadPlaylistId) {
      return null;
    }

    try {
      const searchParams = {
        key: apiKey,
        part: 'snippet,contentDetails',
        playlistId: uploadPlaylistId,
        maxResults: 1
      };

      const response = await this.youtubeApi.get('playlistItems', { params: searchParams });
      const latest = response.data?.items?.[0]?.snippet?.publishedAt;

      return latest ? new Date(latest) : null;
    } catch (error: any) {
      // CustomException은 그대로 전파 (필수 정보이므로)
      if (error instanceof CustomException) {
        throw error;
      }
      // 기타 에러는 경고만 하고 null 반환 (선택적 정보)
      this.logger.warn(`마지막 영상 업로드일 조회 실패: ${uploadPlaylistId}`, error);
      return null;
    }
  }

  /**
   * ISO 8601 duration을 초 단위로 변환
   */
  parseISODurationToSec(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * 초를 HH:MM:SS 형식으로 변환
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * N일 전 ISO 날짜 문자열 반환
   */
  isoAfterNDays(days: number): string {
    return subDays(new Date(), days).toISOString();
  }

  /**
   * 배열을 청크로 분할
   */
  chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 채널 ID 목록으로 업로드 플레이리스트 ID 조회
   */
  async fetchPlaylistIds(channelIds: string[]): Promise<string[]> {
    const serverKey = await this.apiKeyService.getServerApiKey();
    const apiKey = serverKey.apiKey;
    const batches = this.chunk(channelIds, 50);
    const result: string[] = [];

    for (const batch of batches) {
      try {
        const searchParams = {
          key: apiKey,
          part: 'contentDetails',
          id: batch.join(',')
        };

        this.logger.log(`YouTube API 호출: channels.list (playlistIds) - ${batch.length}개 채널`);

        const { data } = await this.youtubeApi.get('channels', { params: searchParams });
        const channels = data?.items ?? [];

        for (const channel of channels) {
          const uploadsPlaylist = channel.contentDetails?.relatedPlaylists?.uploads;
          if (uploadsPlaylist) {
            result.push(uploadsPlaylist);
          }
        }
      } catch (error: any) {
        // CustomException은 그대로 전파
        if (error instanceof CustomException) {
          throw error;
        }
        // 기타 에러는 경고만 하고 계속 진행
        this.logger.warn(`플레이리스트 ID 조회 실패: ${batch.join(', ')}`, error);
      }
    }

    return result;
  }

  /**
   * 플레이리스트에서 비디오 ID 목록 조회
   */
  async fetchVideoIds(
    uploadPlaylistId: string,
    publishedAfter: string,
    pageToken?: string
  ): Promise<{ newPageToken?: string; videoIds: string[]; total: number }> {
    const serverKey = await this.apiKeyService.getServerApiKey();
    const apiKey = serverKey.apiKey;

    try {
      const searchParams: Record<string, any> = {
        key: apiKey,
        part: 'snippet,contentDetails',
        playlistId: uploadPlaylistId,
        maxResults: 50
      };

      if (pageToken) {
        searchParams.pageToken = pageToken;
      }

      const response = await this.youtubeApi.get('playlistItems', { params: searchParams });
      const items = response?.data?.items ?? [];

      if (items.length === 0) {
        return { newPageToken: undefined, videoIds: [], total: 0 };
      }

      let newPageToken = response?.data?.nextPageToken as string | undefined;
      const videoIds: string[] = [];

      for (const item of items) {
        const videoPublishedAt = item.contentDetails?.videoPublishedAt;
        if (videoPublishedAt && videoPublishedAt <= publishedAfter) {
          newPageToken = undefined;
          break;
        }
        if (item.contentDetails?.videoId) {
          videoIds.push(item.contentDetails.videoId);
        }
      }

      return {
        newPageToken,
        videoIds,
        total: response?.data?.pageInfo?.totalResults || 0
      };
    } catch (error: any) {
      // CustomException은 그대로 전파
      if (error instanceof CustomException) {
        throw error;
      }
      // 기타 에러는 경고만 하고 빈 결과 반환
      this.logger.warn(`비디오 ID 조회 실패: ${uploadPlaylistId}`, error);
      return { newPageToken: undefined, videoIds: [], total: 0 };
    }
  }

  /**
   * 비디오 상세 정보 조회
   */
  async fetchVideos(videoIds: string[]): Promise<IYouTubeVideoData[]> {
    if (videoIds.length === 0) return [];

    const serverKey = await this.apiKeyService.getServerApiKey();
    const apiKey = serverKey.apiKey;
    const batches = this.chunk(videoIds, 50);
    const allVideos: IYouTubeVideoData[] = [];

    for (const batch of batches) {
      try {
        const { data } = await this.youtubeApi.get('videos', {
          params: {
            key: apiKey,
            part: 'id,snippet,contentDetails,statistics',
            id: batch.join(',')
          }
        });

        const videos = data?.items ?? [];
        allVideos.push(...videos);
      } catch (error: any) {
        // CustomException은 그대로 전파
        if (error instanceof CustomException) {
          throw error;
        }
        // 기타 에러는 경고만 하고 계속 진행
        this.logger.warn(`비디오 상세 조회 실패: ${batch.length}개`, error);
      }
    }

    return allVideos;
  }

  /**
   * VPH(Views Per Hour) 기준 필터링
   */
  filterByVph(videos: IYouTubeVideoData[], minVph: number): IYouTubeVideoData[] {
    if (minVph <= 0) return videos;

    const now = new Date();
    return videos.filter((video) => {
      const snippet = video.snippet;
      const statistics = video.statistics;

      if (!snippet || !statistics) return false;

      const ageH = Math.max(differenceInHours(now, parseISO(snippet.publishedAt)), 1);
      const views = Number(statistics.viewCount ?? 0);

      return views / ageH >= minVph;
    });
  }

  /**
   * 영상 길이 유효성 검사
   */
  isVideoDurationValid(durSec: number, videoDuration: string): boolean {
    const LONG_MIN = 20 * 60;
    const MEDIUM_MIN = 4 * 60;
    const MEDIUM_MAX = 20 * 60;
    const SHORT_MAX = 4 * 60;

    switch (videoDuration) {
      case 'long':
        return durSec >= LONG_MIN;
      case 'medium':
        return durSec >= MEDIUM_MIN && durSec < MEDIUM_MAX;
      case 'short':
        return durSec < SHORT_MAX;
      default:
        return true;
    }
  }

  /**
   * 영상 유효성 검사 (조회수, 길이)
   */
  isVideoValid(video: IYouTubeVideoData, minViews: number, videoDuration: string): boolean {
    const viewCount = Number(video.statistics?.viewCount ?? 0);
    if (viewCount < minViews) return false;

    const durSec = this.parseISODurationToSec(video.contentDetails?.duration ?? 'PT0S');
    return this.isVideoDurationValid(durSec, videoDuration);
  }

  /**
   * YouTube API 응답을 결과 형식으로 변환
   */
  transformToResults(
    videos: IYouTubeVideoData[],
    channelMap: Map<
      string,
      {
        handle: string | null;
        subscriberCount: number;
        videoCount: number;
        viewCount: string;
        regionCode: string | null;
        link: string;
        publishedAt: Date;
        thumbnailUrl: string | null;
      }
    >
  ) {
    const now = new Date();

    return videos.map((video) => {
      const { id, snippet, statistics, contentDetails } = video;
      const publishedAt = snippet.publishedAt ?? '';
      const ageH = Math.max(differenceInHours(now, parseISO(publishedAt)), 1);
      const views = Number(statistics.viewCount ?? 0);
      const vph = views / ageH;

      const durSec = this.parseISODurationToSec(contentDetails.duration ?? 'PT0S');
      const channelInfo = channelMap.get(snippet.channelId);

      const subs = channelInfo?.subscriberCount ?? null;
      const vps = subs && subs > 0 ? views / subs : null;

      return {
        id,
        channelId: snippet.channelId,
        channelTitle: snippet.channelTitle ?? '',
        title: snippet.title ?? '',
        publishedAt,
        viewCount: views,
        viewsPerHour: vph,
        viewsPerSubscriber: vps,
        duration: this.formatDuration(durSec),
        durationSeconds: durSec,
        link: `https://www.youtube.com/watch?v=${id}`,
        thumbnailUrl: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.default?.url || '',
        likeCount: statistics.likeCount ? Number(statistics.likeCount) : undefined,
        commentCount: statistics.commentCount ? Number(statistics.commentCount) : undefined,
        tags: snippet.tags,
        defaultLanguage: snippet.defaultLanguage,
        defaultAudioLanguage: snippet.defaultAudioLanguage,
        channel: channelInfo || {
          handle: null,
          subscriberCount: 0,
          videoCount: 0,
          viewCount: '0',
          regionCode: null,
          link: '',
          publishedAt: new Date(),
          thumbnailUrl: null
        }
      };
    });
  }

  /**
   * Search API로 비디오 ID 조회 (쿼터 100 소모)
   */
  async fetchVideoIdsByKeyword(params: {
    apiKey: string;
    keyword: string;
    publishedAfter: string;
    videoDuration: 'any' | 'short' | 'medium' | 'long';
    pageToken?: string;
    regionCode?: string;
    relevanceLanguage?: string;
  }): Promise<{ newPageToken?: string; videoIds: string[] }> {
    const { apiKey, keyword, publishedAfter, videoDuration, pageToken, regionCode, relevanceLanguage } = params;

    try {
      const searchParams: Record<string, any> = {
        key: apiKey,
        part: 'id',
        type: 'video',
        q: keyword,
        maxResults: 50,
        order: 'viewCount',
        publishedAfter,
        videoDuration: videoDuration === 'all' ? undefined : videoDuration
      };

      if (regionCode) searchParams.regionCode = regionCode;
      if (relevanceLanguage) searchParams.relevanceLanguage = relevanceLanguage;
      if (pageToken) searchParams.pageToken = pageToken;

      this.logger.log(`YouTube API 호출: search.list (쿼터 100) - keyword: ${keyword}`);

      const response = await this.youtubeApi.get('search', { params: searchParams });
      const items = response?.data?.items ?? [];

      if (items.length === 0) {
        return { newPageToken: undefined, videoIds: [] };
      }

      const newPageToken = response.data?.nextPageToken as string | undefined;
      const videoIds = items.map((item: any) => item?.id?.videoId).filter(Boolean) as string[];

      return { newPageToken, videoIds };
    } catch (error: any) {
      // CustomException은 그대로 전파
      if (error instanceof CustomException) {
        throw error;
      }
      // 기타 에러는 경고만 하고 빈 결과 반환
      this.logger.warn(`비디오 ID 검색 실패: ${keyword}`, error);
      return { newPageToken: undefined, videoIds: [] };
    }
  }

  /**
   * VPH 빠른 검사 (조기 종료 최적화)
   */
  quickVphPass({
    list,
    minVph,
    maxResults
  }: {
    list: IYouTubeVideoData[];
    minVph: number;
    maxResults: number;
  }): IYouTubeVideoData[] {
    if (minVph <= 0) return list;

    const now = new Date();
    const result: IYouTubeVideoData[] = [];

    for (const video of list) {
      const { snippet, statistics } = video;

      if (!snippet || !statistics) continue;

      const ageH = Math.max(differenceInHours(now, parseISO(snippet.publishedAt ?? '')), 1);
      const views = Number(statistics.viewCount ?? 0);
      const vph = views / ageH;

      if (vph >= minVph) {
        result.push(video);
        if (result.length >= maxResults) break; // 조기 종료
      }
    }

    return result;
  }

  /**
   * 영상 조회수 유효성 검사
   */
  isVideoValidViewCount(video: IYouTubeVideoData, minViews: number): boolean {
    const viewCount = Number(video?.statistics?.viewCount ?? 0);
    return viewCount >= minViews;
  }

  /**
   * 채널 통계 정보 조회 (API)
   */
  async fetchChannelStats(
    apiKey: string,
    channelIds: string[]
  ): Promise<
    Record<
      string,
      {
        handle: string | null;
        subscriberCount: number;
        videoCount: number;
        viewCount: string;
        regionCode: string | null;
        link: string;
        publishedAt: Date;
        thumbnailUrl: string | null;
      }
    >
  > {
    const batches = this.chunk(channelIds, 50);
    const stats: Record<
      string,
      {
        handle: string | null;
        subscriberCount: number;
        videoCount: number;
        viewCount: string;
        regionCode: string | null;
        link: string;
        publishedAt: Date;
        thumbnailUrl: string | null;
      }
    > = {};

    for (const batch of batches) {
      try {
        const response = await this.youtubeApi.get('channels', {
          params: {
            key: apiKey,
            part: 'snippet,statistics',
            id: batch.join(',')
          }
        });

        const channels = response.data?.items ?? [];

        for (const ch of channels) {
          const cid = ch?.id as string;
          const hidden = ch?.statistics?.hiddenSubscriberCount;
          const subs = hidden ? 0 : Number(ch?.statistics?.subscriberCount ?? 0);

          if (cid) {
            stats[cid] = {
              handle: (ch.snippet.customUrl as string) || null,
              subscriberCount: subs,
              videoCount: parseInt(ch.statistics.videoCount) || 0,
              viewCount: parseInt(ch.statistics.viewCount).toString() || '0',
              regionCode: ch.snippet.country || null,
              link: `https://www.youtube.com/channel/${cid}`,
              publishedAt: new Date(ch.snippet.publishedAt),
              thumbnailUrl: ch.snippet.thumbnails?.default?.url || null
            };
          }
        }
      } catch (error: any) {
        // CustomException은 그대로 전파
        if (error instanceof CustomException) {
          throw error;
        }
        // 기타 에러는 경고만 하고 계속 진행
        this.logger.warn(`채널 통계 조회 실패: ${batch.join(', ')}`, error);
      }
    }

    return stats;
  }
}

