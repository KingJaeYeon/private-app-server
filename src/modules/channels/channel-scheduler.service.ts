import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/core/prisma.service';
import { YoutubeService } from '@/modules/youtube/youtube.service';

@Injectable()
export class ChannelSchedulerService {
  private readonly logger = new Logger(ChannelSchedulerService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly youtubeService: YoutubeService
  ) {}

  /**
   * 매일 12:00에 실행 (한국 시간 기준)
   * Cron 표현식: '0 16 10 * *' (매일 16시 10분)
   */
  @Cron('0 16 10 * *', {
    name: 'channel-history',
    timeZone: 'Asia/Seoul'
  })
  async syncDailyChannelStatsAndHistory() {
    this.logger.log('🔄 YouTube 채널 History and Sync Daily Channel Stats 갱신');
    const { message } = await this.youtubeService.updateAllChannelsFromYouTube();
    this.logger.log(`✅ ${message}`);
  }
}
