import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ChannelsService } from './channels.service';
// import { ChannelHistoriesService } from './channel-histories.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ChannelResponseDto, ChannelHistoryResponseDto } from './dto';
import { ApiErrorResponses } from '@/common/decorators/api-error-response.decorator';
import { ApiTags } from '@nestjs/swagger';
import { ApiGetResponse } from '@/common/decorators/api-get-response.decorator';
import { Public } from '@/common/decorators';
import { ChannelSuggestDto, ChannelSuggestResponseDto } from '@/modules/channels/dto/channel-suggest.dto';

@ApiTags('Channels')
@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService
    // private readonly channelHistoriesService: ChannelHistoriesService
  ) {}

  // 채널 검색 (필터 + 페이지네이션)
  @Public()
  @Get('search')
  @ApiGetResponse({
    type: ChannelSearchResponseDto,
    operations: { summary: '채널 검색', description: '필터와 함께 채널 검색' }
  })
  async searchChannels(@Query() dto: ChannelSearchDto) {
    return this.channelsService.searchChannels(dto);
  }

  @Public()
  @Get('suggest')
  @ApiGetResponse({
    type: ChannelSuggestResponseDto,
    isArray: true,
    operations: { summary: '채널 자동완성' }
  })
  async getSuggest(@Query() { q }: ChannelSuggestDto) {
    return this.channelsService.getChannelSuggest(q);
  }

  @Get(':channelId')
  @Public()
  @ApiGetResponse({
    type: ChannelResponseDto,
    description: '공통 채널의 상세 정보를 조회합니다.',
    operations: { summary: '채널 상세 조회' }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'CHANNEL_NOT_FOUND'])
  async getChannel(
    @CurrentUser('userId') userId: string,
    @Param('channelId', ParseIntPipe) channelId: number
  ): Promise<ChannelResponseDto> {
    return this.channelsService.getChannelById({ channelId, userId });
  }

  @Get(':channelId/history')
  @ApiGetResponse({
    type: ChannelHistoryResponseDto,
    isArray: true,
    description: '채널 히스토리 조회 성공',
    operations: { summary: '채널 히스토리 조회', description: '특정 채널의 통계 히스토리를 시간순으로 조회합니다.' }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'CHANNEL_NOT_FOUND'])
  async getChannelHistories(@Param('channelId', ParseIntPipe) channelId: number): Promise<ChannelHistoryResponseDto[]> {
    return this.channelHistoriesService.getChannelHistories(channelId);
  }
}
