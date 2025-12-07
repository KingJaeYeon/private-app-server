import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SubscribeChannelDto, UpdateSubscriptionDto, SubscriptionResponseDto } from './dto';
import { ApiActionResponse } from '@/common/decorators/api-action-response.decorator';
import { ApiErrorResponses } from '@/common/decorators/api-error-response.decorator';
import { ApiTags } from '@nestjs/swagger';
import { ApiGetResponse } from '@/common/decorators/api-get-response.decorator';
import { SubscriptionsQueryDto } from '@/modules/channels/dto/channel-query.dto';
import { UnsubscribeChannelDto } from '@/modules/channels/dto/unsubscribe-channel.dto';

@ApiTags('Channels')
@Controller('channels/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiGetResponse({
    type: SubscriptionResponseDto,
    isArray: true,
    operations: {
      summary: '내 구독 목록 조회',
      description: '현재 사용자가 구독한 채널 목록을 조회합니다. 태그 정보가 포함됩니다.'
    }
  })
  @ApiErrorResponses(['UNAUTHORIZED'])
  async getMySubscriptions(
    @Query() query: SubscriptionsQueryDto,
    @CurrentUser('userId') userId: string
  ): Promise<SubscriptionResponseDto[]> {
    return this.subscriptionService.getSubscriptions(query, userId);
  }

  @Post()
  @ApiActionResponse({
    description: '채널 구독 성공 (Bulk 작업)',
    body: { count: 2 },
    operations: {
      summary: '채널 구독 (Bulk)',
      description:
        'YouTube 채널을 구독합니다. 기존 채널이면 구독만 추가하고, 새 채널이면 생성 후 구독합니다. 여러 채널을 한 번에 구독할 수 있습니다. 하나라도 실패하면 전체 롤백됩니다.'
    }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'CHANNEL_NOT_FOUND', 'ALREADY_SUBSCRIBED'])
  async subscribeChannel(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubscribeChannelDto
  ): Promise<{ count: number }> {
    return this.subscriptionService.subscribeChannel(userId, dto);
  }

  @Patch(':subscriptionId')
  @ApiActionResponse({
    body: { id: 3, message: '구독이 업데이트되었습니다.' },
    description: '구독 업데이트 성공',
    operations: { summary: '구독 업데이트', description: '구독한 채널의 태그를 업데이트합니다.' }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'SUBSCRIPTION_NOT_FOUND', 'TAG_NOT_FOUND'])
  async updateSubscription(
    @CurrentUser('userId') userId: string,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
    @Body() dto: UpdateSubscriptionDto
  ): Promise<{ id?: number; message?: string }> {
    await this.subscriptionService.updateSubscription(userId, subscriptionId, dto);
    return { id: subscriptionId, message: '구독이 업데이트되었습니다.' };
  }

  @Delete()
  @ApiActionResponse({
    description: '구독 취소 성공 (Bulk 작업)',
    body: { count: 3 },
    operations: {
      summary: '구독 취소 (Bulk)',
      description: '채널 구독을 취소합니다. 여러 구독을 한 번에 취소할 수 있습니다. 하나라도 실패하면 전체 롤백됩니다.'
    }
  })
  @ApiErrorResponses(['UNAUTHORIZED', 'SUBSCRIPTION_NOT_FOUND'])
  async unsubscribeChannels(
    @CurrentUser('userId') userId: string,
    @Body() { subscriptionIds }: UnsubscribeChannelDto
  ): Promise<{ count: number }> {
    return this.subscriptionService.unsubscribeChannels(userId, subscriptionIds);
  }
}
