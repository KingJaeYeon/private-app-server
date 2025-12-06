import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { YoutubeApiKeyService } from './youtube-api-key.service';

/**
 * YouTube API 키 사용량 초기화 스케줄러
 * 매일 16:00에 모든 사용자의 일일 사용량을 초기화
 */
@Injectable()
export class YoutubeSchedulerService {
  private readonly logger = new Logger(YoutubeSchedulerService.name);

  constructor(private readonly apiKeyService: YoutubeApiKeyService) {}

  /**
   * 매일 16:00에 실행 (한국 시간 기준)
   * Cron 표현식: '0 16 * * *' (매일 16시 0분)
   */
  @Cron('0 16 * * *', {
    name: 'reset-youtube-api-usage',
    timeZone: 'Asia/Seoul'
  })
  async handleResetDailyUsage() {
    this.logger.log('🔄 YouTube API 사용량 초기화 시작...');

    try {
      const result = await this.apiKeyService.resetDailyUsage();
      this.logger.log(
        `✅ YouTube API 사용량 초기화 완료: 유저 ${result.userCount}개, 서버 ${result.serverCount}개`
      );
    } catch (error) {
      this.logger.error('❌ YouTube API 사용량 초기화 실패', error);
    }
  }
}

