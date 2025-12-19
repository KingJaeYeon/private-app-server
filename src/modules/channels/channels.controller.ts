import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ChannelsService } from './channels.service';
// import { ChannelHistoriesService } from './channel-histories.service';
import { ApiErrorResponses } from '@/common/decorators/api-error-response.decorator';
import { ApiTags } from '@nestjs/swagger';
import { ApiGetResponse } from '@/common/decorators/api-get-response.decorator';
import { ChannelListDto, SuggestDto } from '@/modules/channels/dto/request.dto';
import { ChannelListResponseDto, ChannelResponseDto, SuggestResponseDto } from '@/modules/channels/dto/response.dto';
import { toResponseDto } from '@/common/helper/to-response-dto.helper';

@ApiTags('Channels')
@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService
    // private readonly channelHistoriesService: ChannelHistoriesService
  ) {}

  // // 채널 검색 (필터 + 페이지네이션)
  @Get()
  @ApiGetResponse({
    type: ChannelListResponseDto,
    operations: { summary: '채널 검색', description: '필터와 함께 채널 검색' }
  })
  async getChannels(@Query() dto: ChannelListDto): Promise<ChannelListResponseDto> {
    const channels = await this.channelsService.getChannels(dto);
    return toResponseDto(ChannelListResponseDto, channels);
  }

  @Get('suggest')
  @ApiGetResponse({
    type: SuggestResponseDto,
    isArray: true,
    operations: { summary: '채널 검색창에서 사용되는 API' }
  })
  async getSuggestChannels(@Query() { q }: SuggestDto) {
    return this.channelsService.getChannelSuggest(q);
  }

  @Get(':channelId')
  @ApiGetResponse({
    type: ChannelResponseDto,
    description: '공통 채널의 상세 정보를 조회합니다.',
    operations: { summary: '채널 상세 조회' }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'CHANNEL_NOT_FOUND'])
  async getChannel(@Param('channelId', ParseIntPipe) channelId: number): Promise<ChannelResponseDto> {
    return this.channelsService.getChannelById({ channelId, userId: '' });
  }

  // @Get(':channelId/history')
  // @ApiGetResponse({
  //   type: ChannelHistoryResponseDto,
  //   isArray: true,
  //   description: '채널 히스토리 조회 성공',
  //   operations: { summary: '채널 히스토리 조회', description: '특정 채널의 통계 히스토리를 시간순으로 조회합니다.' }
  // })
  // @ApiErrorResponses(['UNAUTHORIZED', 'CHANNEL_NOT_FOUND'])
  // async getChannelHistories(@Param('channelId', ParseIntPipe) channelId: number): Promise<ChannelHistoryResponseDto[]> {
  //   return this.channelHistoriesService.getChannelHistories(channelId);
  // }
}
