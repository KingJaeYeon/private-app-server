import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelHistoriesService } from './channel-histories.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ChannelResponseDto, ChannelHistoryResponseDto, ChannelAuthResponseDto } from './dto';
import { ApiErrorResponses } from '@/common/decorators/api-error-response.decorator';
import { ApiTags } from '@nestjs/swagger';
import { ApiGetResponse } from '@/common/decorators/api-get-response.decorator';
import { Public } from '@/common/decorators';
import { toResponseDto } from '@/common/helper/to-response-dto.helper';
import { ChannelQueryDto } from '@/modules/channels/dto/channel-query.dto';

@ApiTags('Channels')
@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly channelHistoriesService: ChannelHistoriesService
  ) {}

  @Get()
  @ApiGetResponse({
    type: ChannelAuthResponseDto,
    isArray: true,
    operations: { summary: '공통 채널 목록 조회 ', description: '공통 채널 목록을 조회합니다.' }
  })
  @ApiErrorResponses(['UNAUTHORIZED'])
  async getChannels(
    @CurrentUser('userId') userId: string,
    @Query() query: ChannelQueryDto
  ): Promise<ChannelAuthResponseDto> {
    const channels = await this.channelsService.getChannelsWithSubscription(userId, query);
    const lastCursor = channels.length > 0 ? channels[channels.length - 1].id : null;

    return toResponseDto(ChannelAuthResponseDto, {
      channel: toResponseDto(ChannelResponseDto, channels),
      cursor: lastCursor,
      hasNext: channels.length === query.take,
      orderBy: query.orderBy,
      order: query.order
    });
  }

  @Get('public/:channelId')
  @Public()
  @ApiGetResponse({
    type: ChannelResponseDto,
    description: '공통 채널의 상세 정보를 조회합니다.',
    operations: { summary: '채널 상세 조회' }
  })
  @ApiErrorResponses(['CHANNEL_NOT_FOUND'])
  async getChannelForPublic(@Param('channelId', ParseIntPipe) channelId: number): Promise<ChannelResponseDto> {
    return this.channelsService.getChannelById({ channelId });
  }

  @Get(':channelId')
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
