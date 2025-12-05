import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelHistoriesService } from './channel-histories.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  SubscribeChannelDto,
  UpdateSubscriptionDto,
  SubscriptionResponseDto,
  ChannelResponseDto,
  ChannelHistoryResponseDto,
  ChannelAuthResponseDto
} from './dto';
import { ApiActionResponse } from '@/common/decorators/api-action-response.decorator';
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

  @Get('public')
  @Public()
  @ApiGetResponse({
    type: ChannelResponseDto,
    isArray: true,
    operations: { summary: '공통 채널 목록 조회(인증 X)', description: '공통 채널 목록을 조회합니다.(인증 X)' }
  })
  async getChannelsForPublic(): Promise<ChannelResponseDto[]> {
    const channels = await this.channelsService.getChannelsForPublic();
    return toResponseDto(ChannelResponseDto, channels);
  }

  @Get()
  @ApiGetResponse({
    type: ChannelAuthResponseDto,
    isArray: true,
    operations: { summary: '공통 채널 목록 조회 ', description: '공통 채널 목록을 조회합니다.' }
  })
  @ApiErrorResponses(['UNAUTHORIZED'])
  async getChannels(@Query() query: ChannelQueryDto): Promise<ChannelAuthResponseDto> {
    const channels = await this.channelsService.getChannels(query);
    const lastCursor = channels.length > 0 ? channels[channels.length - 1].id : null;
    return {
      channel: toResponseDto(ChannelResponseDto, channels),
      cursor: lastCursor,
      hasNext: channels.length === query.take,
      orderBy: query.orderBy,
      order: query.order
    };
  }

  @Get('subscriptions')
  @ApiGetResponse({
    type: SubscriptionResponseDto,
    isArray: true,
    operations: {
      summary: '내 구독 목록 조회',
      description: '현재 사용자가 구독한 채널 목록을 조회합니다. 태그 정보가 포함됩니다.'
    }
  })
  @ApiErrorResponses(['UNAUTHORIZED'])
  async getMySubscriptions(@CurrentUser('userId') userId: string): Promise<SubscriptionResponseDto[]> {
    return this.channelsService.getSubscriptions(userId);
  }

  /**
   * 채널 구독
   */
  @Post('subscribe')
  @ApiActionResponse({
    responseType: { type: SubscriptionResponseDto },
    description: '채널 구독 성공',
    operations: {
      summary: '채널 구독',
      description: 'YouTube 채널을 구독합니다. 기존 채널이면 구독만 추가하고, 새 채널이면 생성 후 구독합니다.'
    }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'CHANNEL_NOT_FOUND', 'ALREADY_SUBSCRIBED', 'TAG_NOT_FOUND'])
  async subscribeChannel(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubscribeChannelDto
  ): Promise<SubscriptionResponseDto> {
    return this.channelsService.subscribeChannel(userId, dto);
  }

  /**
   * 구독 업데이트 (태그 추가/제거)
   */
  @Patch('subscriptions/:subscriptionId')
  @ApiActionResponse({
    responseType: { type: SubscriptionResponseDto },
    status: 200,
    description: '구독 업데이트 성공',
    operations: { summary: '구독 업데이트', description: '구독한 채널의 태그를 업데이트합니다.' }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'SUBSCRIPTION_NOT_FOUND', 'TAG_NOT_FOUND'])
  async updateSubscription(
    @CurrentUser('userId') userId: string,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
    @Body() dto: UpdateSubscriptionDto
  ): Promise<SubscriptionResponseDto> {
    return this.channelsService.updateSubscription(userId, subscriptionId, dto);
  }

  /**
   * 구독 취소
   */
  @Delete('subscriptions/:subscriptionId')
  @ApiActionResponse({
    message: '구독 취소 성공',
    status: 200,
    operations: { summary: '구독 취소', description: '채널 구독을 취소합니다.' }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'SUBSCRIPTION_NOT_FOUND'])
  async unsubscribeChannel(
    @CurrentUser('userId') userId: string,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number
  ): Promise<{ message: string }> {
    await this.channelsService.unsubscribeChannel(userId, subscriptionId);
    return { message: '구독 취소 성공' };
  }

  /**
   * 구독 상세 조회
   */
  @Get('subscriptions/:subscriptionId')
  @ApiActionResponse({
    responseType: { type: SubscriptionResponseDto },
    status: 200,
    description: '구독 상세 조회 성공',
    operations: { summary: '구독 상세 조회', description: '특정 구독의 상세 정보를 조회합니다.' }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'SUBSCRIPTION_NOT_FOUND'])
  async getSubscription(
    @CurrentUser('userId') userId: string,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number
  ): Promise<SubscriptionResponseDto> {
    return this.channelsService.getSubscriptionById(userId, subscriptionId);
  }

  /**
   * 채널 상세 조회 (공통 채널 정보)
   */
  @Get(':channelId')
  @ApiActionResponse({
    responseType: { type: ChannelResponseDto },
    status: 200,
    description: '채널 상세 조회 성공',
    operations: { summary: '채널 상세 조회', description: '공통 채널의 상세 정보를 조회합니다.' }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'CHANNEL_NOT_FOUND'])
  async getChannel(@Param('channelId', ParseIntPipe) channelId: number): Promise<ChannelResponseDto> {
    return this.channelsService.getChannelById(channelId);
  }

  /**
   * 채널 히스토리 조회
   */
  @Get(':channelId/histories')
  @ApiActionResponse({
    responseType: { type: ChannelHistoryResponseDto, isArray: true },
    status: 200,
    description: '채널 히스토리 조회 성공',
    operations: { summary: '채널 히스토리 조회', description: '특정 채널의 통계 히스토리를 시간순으로 조회합니다.' }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'CHANNEL_NOT_FOUND'])
  async getChannelHistories(@Param('channelId', ParseIntPipe) channelId: number): Promise<ChannelHistoryResponseDto[]> {
    return this.channelHistoriesService.getChannelHistories(channelId);
  }
}
