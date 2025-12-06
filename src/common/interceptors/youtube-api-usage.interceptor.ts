import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { USE_YOUTUBE_API_KEY } from '@/common/decorators/use-youtube-api.decorator';
import { YoutubeApiKeyService } from '@/modules/youtube/youtube-api-key.service';
import { CustomException } from '@/common/exceptions';

/**
 * YouTube API 사용량 추적 인터셉터
 * 데코레이터가 있는 엔드포인트에서 서버 API 키 사용량을 자동으로 증가시킴
 */
@Injectable()
export class YoutubeApiUsageInterceptor implements NestInterceptor {
  private readonly logger = new Logger(YoutubeApiUsageInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: YoutubeApiKeyService
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    // 데코레이터에서 쿼터 가져오기
    const quota = this.reflector.get<number>(USE_YOUTUBE_API_KEY, context.getHandler());

    // 데코레이터가 없으면 통과 (키워드 검색 등 유저 API 키 사용)
    if (!quota) {
      return next.handle();
    }

    // 사용자 ID 추출
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      // 인증되지 않은 사용자는 통과 (다른 가드에서 처리)
      return next.handle();
    }

    try {
      // 서버 API 키 사용량 증가 (트랜잭션으로 안전하게 처리)
      await this.apiKeyService.useServerApiKey(userId, quota);
    } catch (error) {
      // 사용량 초과 등 에러는 그대로 전파
      if (error instanceof CustomException) {
        throw error;
      }
      this.logger.error('YouTube API 사용량 증가 실패', error);
      throw error;
    }

    return next.handle();
  }
}

