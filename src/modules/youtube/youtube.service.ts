import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { differenceInHours, parseISO, startOfDay } from 'date-fns';
import {
  IYouTubeChannelData,
  IYouTubeVideoData,
  IVideoSearchFilter,
  IVideoSearchResult,
  IKeywordSearchFilter,
  IKeywordSearchResult
} from './youtube.interface';
import { YoutubeApiKeyService } from './youtube-api-key.service';
import { YoutubeHelperService } from './youtube-helper.service';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private readonly youtubeApi: AxiosInstance;

  constructor(
    private readonly db: PrismaService,
    private readonly apiKeyService: YoutubeApiKeyService,
    private readonly helperService: YoutubeHelperService
  ) {
    this.youtubeApi = axios.create({
      baseURL: 'https://www.googleapis.com/youtube/v3',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * YouTube API로 채널 정보 조회
   */
  async fetchChannelsByHandle(handles: string[]): Promise<IYouTubeChannelData[]> {
    const serverKey = await this.apiKeyService.getServerApiKey();
    const apiKey = serverKey.apiKey;

    try {
      const searchParams = {
        key: apiKey,
        part: 'snippet,statistics,contentDetails',
        forHandle: handles.join(',')
      };

      this.logger.log(`YouTube API 호출: channels.list - handles: ${handles.join(', ')}`);

      const response = await this.youtubeApi.get('channels', { params: searchParams });
      const items = response.data?.items ?? [];

      if (items.length === 0) {
        throw new CustomException('CHANNEL_NOT_FOUND', { handles });
      }

      // 각 채널의 마지막 영상 업로드일 조회
      const channelsWithLastVideo = await Promise.all(
        items.map(async (item: any) => {
          const lastVideoUploadedAt = await this.helperService.fetchLastPublishedAt(
            apiKey,
            item.contentDetails?.relatedPlaylists?.uploads
          );

          return {
            ...item,
            lastVideoUploadedAt
          };
        })
      );

      return channelsWithLastVideo;
    } catch (error: any) {
      // CustomException은 그대로 전파
      if (error instanceof CustomException) {
        throw error;
      }
      // 기타 예상치 못한 에러
      this.logger.error('YouTube API 요청 실패', error);
      throw new CustomException('CHANNEL_NOT_FOUND', { handles });
    }
  }

  async updateAllChannelsFromYouTube() {
    const today = startOfDay(new Date());

    const channels = await this.db.channel.findMany({
      where: { updatedAt: { lt: today } }
    });

    if (channels.length === 0) {
      return { message: 'there is no channels for update.' };
    }

    return { message: 'YouTube API: channels updated successfully.' };
  }

  /**
   * YouTube API 응답을 Channel 모델로 변환하여 DB에 저장
   */
  async createChannelsFromYouTube(youtubeChannels: IYouTubeChannelData[]) {
    const channelsToCreate = youtubeChannels.map((item) => ({
      channelId: item.id,
      name: item.snippet.title,
      handle: item.snippet.customUrl || null,
      description: item.snippet.description || null,
      link: `https://www.youtube.com/channel/${item.id}`,
      thumbnailUrl: item.snippet.thumbnails?.default?.url || null,
      regionCode: item.snippet.country || null,
      defaultLanguage: item.snippet.defaultLanguage || null,
      videoCount: parseInt(item.statistics.videoCount) || 0,
      viewCount: BigInt(item.statistics.viewCount || 0),
      subscriberCount: parseInt(item.statistics.subscriberCount) || 0,
      publishedAt: new Date(item.snippet.publishedAt),
      lastVideoUploadedAt: item.lastVideoUploadedAt
    }));

    // 일괄 생성 (중복 시 스킵)
    await this.db.channel.createMany({
      data: channelsToCreate,
      skipDuplicates: true
    });

    // 생성된 채널 조회
    const channelIds = channelsToCreate.map((c) => c.channelId);
    return this.db.channel.findMany({
      where: {
        channelId: { in: channelIds }
      }
    });
  }

  /**
   * 채널 목록 기반 영상 검색
   */
  async getVideosByChannels(
    userId: string,
    channelIds: string[],
    filter: IVideoSearchFilter
  ): Promise<IVideoSearchResult[]> {
    const { minViews, minViewsPerHour, videoDuration, days, maxChannels, isPopularVideosOnly } = filter;

    // 1. 사용자의 구독 채널 정보 조회
    const userChannels = await this.db.channel.findMany({
      where: {
        channelId: { in: channelIds },
        subscription: {
          some: {
            userId
          }
        }
      },
      select: {
        channelId: true,
        handle: true,
        subscriberCount: true,
        videoCount: true,
        viewCount: true,
        regionCode: true,
        link: true,
        publishedAt: true,
        thumbnailUrl: true
      }
    });

    if (userChannels.length === 0) {
      return [];
    }

    const channelMap = new Map(
      userChannels.map((ch) => [
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

    // 2. 업로드 플레이리스트 ID 조회
    const uploadPlaylistIds = await this.helperService.fetchPlaylistIds(userChannels.map((ch) => ch.channelId));

    if (uploadPlaylistIds.length === 0) {
      return [];
    }

    const publishedAfter = this.helperService.isoAfterNDays(days);
    const collected: IVideoSearchResult[] = [];

    // 3. 각 채널의 영상 수집
    for (const uploadPlaylistId of uploadPlaylistIds) {
      let pageToken: string | undefined = undefined;

      if (isPopularVideosOnly) {
        // 인기 영상만: 모든 페이지 수집 후 필터링 및 정렬
        const allVideos: IYouTubeVideoData[] = [];

        do {
          const { videoIds, newPageToken } = await this.helperService.fetchVideoIds(
            uploadPlaylistId,
            publishedAfter,
            pageToken
          );
          pageToken = newPageToken;

          if (videoIds.length > 0) {
            const videos = await this.helperService.fetchVideos(videoIds);
            allVideos.push(...videos);
          }
        } while (pageToken);

        const filtered = this.helperService
          .filterByVph(allVideos, minViewsPerHour)
          .filter((v) => this.helperService.isVideoValid(v, minViews, videoDuration));

        const results = this.helperService.transformToResults(filtered, channelMap);
        const sorted = results.sort((a, b) => b.viewsPerHour - a.viewsPerHour);
        collected.push(...sorted.slice(0, maxChannels));
      } else {
        // 일반 모드: maxChannels만큼만 수집
        const allVideos: IYouTubeVideoData[] = [];

        while (allVideos.length < maxChannels) {
          const { videoIds, newPageToken } = await this.helperService.fetchVideoIds(
            uploadPlaylistId,
            publishedAfter,
            pageToken
          );
          pageToken = newPageToken;

          if (videoIds.length > 0) {
            const videos = await this.helperService.fetchVideos(videoIds);
            const filtered = this.helperService
              .filterByVph(videos, minViewsPerHour)
              .filter((v) => this.helperService.isVideoValid(v, minViews, videoDuration));
            allVideos.push(...filtered);
          }

          if (!pageToken) break;
        }

        const results = this.helperService.transformToResults(allVideos.slice(0, maxChannels), channelMap);
        collected.push(...results);
      }
    }

    // 4. 최종 정렬 및 번호 부여
    return collected
      .sort((a, b) => b.viewsPerHour - a.viewsPerHour)
      .map((video, index) => ({
        ...video,
        id: `${index + 1}_${video.id}`
      }));
  }

  /**
   * 키워드 기반 영상 검색 (Search API 사용, 쿼터 100 소모)
   * 유저 API 키 사용 (인터셉터 적용 안 됨)
   */
  async getVideosByKeywords(userId: string, filter: IKeywordSearchFilter): Promise<IKeywordSearchResult[]> {
    // 1. 사용자 API 키 조회 (사용량 체크 포함)
    const userApiKey = await this.apiKeyService.getUserApiKey(userId);

    if (!userApiKey) {
      throw new CustomException('YOUTUBE_API_KEY_NOT_FOUND');
    }

    const apiKey = userApiKey.apiKey;
    const { keyword, days, maxResults, regionCode, relevanceLanguage, videoDuration, minViews, minViewsPerHour } =
      filter;

    const publishedAfter = this.helperService.isoAfterNDays(days);
    const collected: IYouTubeVideoData[] = [];
    const seen = new Set<string>(); // 중복 방지
    let pageToken: string | undefined = undefined;
    let isFoundMinViewsUnder = false; // 최소 조회수 미달 등장 여부
    const MAX_REQUESTS = 20; // 무한루프 방지
    let requestCount = 0;

    // 2. Search API로 비디오 ID 수집
    while (requestCount < MAX_REQUESTS) {
      // VPH 빠른 검사 (있으면 조기 종료)
      if (minViewsPerHour > 0 && collected.length > 0) {
        const quick = this.helperService.quickVphPass({ list: collected, minVph: minViewsPerHour, maxResults });
        if (quick.length >= maxResults) {
          return await this.toKeywordResults({ items: quick.slice(0, maxResults), apiKey, userId });
        }
      } else if (collected.length >= maxResults) {
        return await this.toKeywordResults({ items: collected.slice(0, maxResults), apiKey, userId });
      }

      // 종료 조건
      if (isFoundMinViewsUnder) break;

      // Search API 호출 (쿼터 100 소모)
      const { newPageToken, videoIds } = await this.helperService.fetchVideoIdsByKeyword({
        apiKey,
        keyword,
        publishedAfter,
        videoDuration,
        pageToken,
        regionCode,
        relevanceLanguage
      });

      // Search API 호출 시 사용량 증가 (쿼터 100) - 유저 API 키
      if (videoIds.length > 0) {
        await this.apiKeyService.incrementUserUsage(userId, 100);
      }

      pageToken = newPageToken;

      if (videoIds.length === 0) break;

      // 중복 제거
      const uniqueIds = videoIds.filter((id) => {
        if (!seen.has(id)) {
          seen.add(id);
          return true;
        }
        return false;
      });

      if (uniqueIds.length === 0) {
        if (!pageToken) break;
        requestCount++;
        continue;
      }

      // Videos API 호출 (쿼터 1 소모)
      const videos = await this.helperService.fetchVideos(uniqueIds);

      // Videos API 호출 시 사용량 증가 (쿼터 1) - 유저 API 키
      if (videos.length > 0) {
        await this.apiKeyService.incrementUserUsage(userId, 1);
      }

      if (videos.length === 0) {
        if (!pageToken) break;
        requestCount++;
        continue;
      }

      // 최소 조회수 필터링
      let batchAllPass = true;
      for (const video of videos) {
        if (!this.helperService.isVideoValidViewCount(video, minViews)) {
          batchAllPass = false;
          isFoundMinViewsUnder = true;
          break;
        }
      }

      // 통과한 것만 수집
      for (const video of videos) {
        if (this.helperService.isVideoValidViewCount(video, minViews)) {
          collected.push(video);

          // VPH 조건 없으면 want 채우자마자 반환
          if (minViewsPerHour <= 0 && collected.length >= maxResults) {
            return await this.toKeywordResults({ items: collected.slice(0, maxResults), apiKey, userId });
          }
        }
      }

      if (!batchAllPass || !pageToken) break;
      requestCount++;
    }

    // 3. 최종 VPH 필터링 및 반환
    const pass =
      minViewsPerHour > 0
        ? this.helperService.quickVphPass({ list: collected, minVph: minViewsPerHour, maxResults })
        : collected;

    return await this.toKeywordResults({ items: pass.slice(0, maxResults), apiKey, userId });
  }

  /**
   * 키워드 검색 결과를 최종 형식으로 변환
   */
  private async toKeywordResults({
    items,
    apiKey,
    userId
  }: {
    items: IYouTubeVideoData[];
    apiKey: string;
    userId: string;
  }): Promise<IKeywordSearchResult[]> {
    // 채널 ID 수집
    const channelIds = Array.from(new Set(items.map((v) => v?.snippet?.channelId).filter(Boolean))) as string[];

    // DB에서 구독 채널 정보 조회
    const subscribedChannels = await this.db.channel.findMany({
      where: {
        channelId: { in: channelIds },
        subscription: {
          some: { userId }
        }
      },
      select: {
        channelId: true,
        handle: true,
        subscriberCount: true,
        videoCount: true,
        viewCount: true,
        regionCode: true,
        link: true,
        publishedAt: true,
        thumbnailUrl: true
      }
    });

    const channelMap = new Map(
      subscribedChannels.map((ch) => [
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

    // DB에 없는 채널은 API로 조회 (쿼터 1 소모) - 유저 API 키
    const missingChannelIds = channelIds.filter((id) => !channelMap.has(id));
    if (missingChannelIds.length > 0) {
      const apiChannels = await this.helperService.fetchChannelStats(apiKey, missingChannelIds);
      for (const [channelId, stats] of Object.entries(apiChannels)) {
        channelMap.set(channelId, stats);
      }
      // Channels API 호출 시 사용량 증가 (쿼터 1 per batch) - 유저 API 키
      const batchCount = Math.ceil(missingChannelIds.length / 50);
      await this.apiKeyService.incrementUserUsage(userId, batchCount);
    }

    // 결과 변환
    const now = new Date();
    return items.map((video) => {
      const { id, snippet, statistics, contentDetails } = video;
      const publishedAt = snippet.publishedAt ?? '';
      const ageH = Math.max(differenceInHours(now, parseISO(publishedAt)), 1);
      const views = Number(statistics.viewCount ?? 0);
      const vph = views / ageH;

      const durSec = this.helperService.parseISODurationToSec(contentDetails.duration ?? 'PT0S');
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
        duration: this.helperService.formatDuration(durSec),
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
}
