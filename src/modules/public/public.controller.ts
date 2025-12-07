/**
 * [Domain] Public
 * - 인증 없이 접근 가능한 데이터
 */
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { Public } from '@/common/decorators';
import { PublicService } from '@/modules/public/public.service';
import { ApiGetResponse } from '@/common/decorators/api-get-response.decorator';
import { ChannelBaseResponseDto } from '@/modules/channels/dto';
import { toResponseDto } from '@/common/helper/to-response-dto.helper';
import { ApiErrorResponses } from '@/common/decorators/api-error-response.decorator';

@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('channels')
  @ApiGetResponse({
    type: ChannelBaseResponseDto,
    isArray: true,
    operations: { summary: '공통 채널 목록 조회(인증 X)', description: '공통 채널 목록을 조회합니다.(인증 X)' }
  })
  async getChannels(): Promise<ChannelBaseResponseDto[]> {
    const channels = await this.publicService.getChannels();
    return toResponseDto(ChannelBaseResponseDto, channels);
  }

  @Get('channels/:channelId')
  @ApiGetResponse({
    type: ChannelBaseResponseDto,
    description: '공통 채널의 상세 정보를 조회합니다.',
    operations: { summary: '채널 상세 조회' }
  })
  @ApiErrorResponses(['CHANNEL_NOT_FOUND', 'FORBIDDEN'])
  async getChannelDetail(@Param('channelId', ParseIntPipe) channelId: number): Promise<ChannelBaseResponseDto> {
    const channel = this.publicService.getChannelById(channelId);
    return toResponseDto(ChannelBaseResponseDto, channel);
  }
}
