import { Injectable } from '@nestjs/common';
import { differenceInHours, parseISO, subDays } from 'date-fns';
import { IChannelStats, IYouTubeVideoData } from '@/modules/youtube/youtube.interface';

@Injectable()
export class YoutubeHelperService {
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
   * youtube-api.service searchVideos - publishedAfter에 사용
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
   * VPH 빠른 검사 (조기 종료 최적화)
   */
  quickVphPass(params: { list: IYouTubeVideoData[]; minVph: number; maxResults: number }): IYouTubeVideoData[] {
    if (params.minVph <= 0) return params.list;

    const now = new Date();
    const result: IYouTubeVideoData[] = [];

    for (const video of params.list) {
      const { snippet, statistics } = video;
      if (!snippet || !statistics) continue;

      const ageH = Math.max(differenceInHours(now, parseISO(snippet.publishedAt ?? '')), 1);
      const views = Number(statistics.viewCount ?? 0);
      const vph = views / ageH;

      if (vph >= params.minVph) {
        result.push(video);
        if (result.length >= params.maxResults) break;
      }
    }

    return result;
  }

  /**
   * YouTube API 응답을 결과 형식으로 변환
   */
  transformToResults(videos: IYouTubeVideoData[], channelMap: Map<string, IChannelStats>) {
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
        channel: channelInfo || this.getDefaultChannelInfo()
      };
    });
  }

  private getDefaultChannelInfo(): IChannelStats {
    return {
      handle: null,
      subscriberCount: 0,
      videoCount: 0,
      viewCount: '0',
      regionCode: null,
      link: '',
      publishedAt: new Date(),
      thumbnailUrl: null
    };
  }
}
