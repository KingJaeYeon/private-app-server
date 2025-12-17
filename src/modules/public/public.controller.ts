/**
 * [Domain] Public
 * - 인증 없이 접근 가능한 데이터
 */
import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '@/common/decorators';
import { PublicService } from '@/modules/public/public.service';
import { ApiGetResponse } from '@/common/decorators/api-get-response.decorator';
import { ChannelBaseResponseDto, ChannelHistoryResponseDto } from '@/modules/channels/dto';
import { toResponseDto } from '@/common/helper/to-response-dto.helper';
import { ApiErrorResponses } from '@/common/decorators/api-error-response.decorator';

@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('channels/:identifier/history')
  @ApiGetResponse({
    type: ChannelBaseResponseDto,
    isArray: true,
    description: '공통 채널의 history를 조회합니다.',
    operations: { summary: '공통 채널의 history 조회' }
  })
  @ApiErrorResponses(['CHANNEL_NOT_FOUND', 'FORBIDDEN'])
  async getChannelHistory(@Param('identifier') identifier: string): Promise<ChannelHistoryResponseDto[]> {
    const channelHistory = await this.publicService.getChannelHistory(identifier);
    return toResponseDto(ChannelHistoryResponseDto, channelHistory);
  }
}
