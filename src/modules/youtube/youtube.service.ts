import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { IYouTubeChannelData } from './youtube.interface';
import { YoutubeApiKeyService } from './youtube-api-key.service';
import { YoutubeHelperService } from './youtube-helper.service';
import { YoutubeApiService } from '@/modules/youtube/youtube-api.service';

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly apiKeyService: YoutubeApiKeyService,
    private readonly api: YoutubeApiService,
    private readonly helper: YoutubeHelperService
  ) {}

  /**
   * 핸들로 채널 정보 조회 및 DB 저장
   */
  async fetchChannelsByHandle(handles: string[]) {
    const serverKey = await this.apiKeyService.getServerApiKey();
    this.logger.log(`채널 조회 시작: ${handles.join(', ')}`);

    // ✅ 배치 처리 (최대 50개씩)
    const { items } = await this.api.fetchChannelsBatch({
      apiKey: serverKey.apiKey,
      apiKeyId: serverKey.id,
      handles
    });

    if (items.length === 0) {
      throw new CustomException('CHANNEL_NOT_FOUND', { handles });
    }

    // 각 채널의 마지막 영상 업로드일 조회
    return await Promise.all(
      items.map(async (item: any) => {
        const uploadPlaylistId = item.contentDetails?.relatedPlaylists?.uploads;
        const lastVideoUploadedAt = await this.api.fetchLastVideoUploadedAt({
          upload: uploadPlaylistId,
          apiKeyId: serverKey.id,
          apiKey: serverKey.apiKey
        });
        return { ...item, lastVideoUploadedAt };
      })
    );
  }

  /**
   * YouTube 채널 데이터를 DB에 저장
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
      lastVideoUploadedAt: item.lastVideoUploadedAt,
      fetchedAt: new Date()
    }));

    await this.db.channel.createMany({
      data: channelsToCreate,
      skipDuplicates: true
    });

    const channelIds = channelsToCreate.map((c) => c.channelId);
    return this.db.channel.findMany({
      where: { channelId: { in: channelIds } }
    });
  }
}
