import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { ChannelResponseDto } from './dto';
import { Channel } from '@generated/prisma/client';
import { ChannelQueryDto } from '@/modules/channels/dto/channel-query.dto';
import { TagsService } from '@/modules/tags/tags.service';
import { TaggableType } from '@generated/prisma/client';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly db: PrismaService,
    private readonly tagsService: TagsService
  ) {}

  async getChannelsForPublic(): Promise<Channel[]> {
    return this.db.channel.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
  }

  async getChannelsWithSubscription(userId: string, query: ChannelQueryDto): Promise<Channel[]> {
    const { take, orderBy, order, cursor } = query;

    const channels = await this.db.channel.findMany({
      take: take,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { [orderBy]: order }
    });

    const channelIds = channels.map((c) => c.id);
    const subscriptions = await this.db.subscription.findMany({
      where: {
        userId,
        channelId: { in: channelIds }
      },
      select: { id: true, channelId: true }
    });

    const subscriptionMap = new Map(subscriptions.map((s) => [s.channelId, s.id]));

    // 결과 조합
    return channels.map((channel) => ({
      ...channel,
      isSubscribed: subscriptionMap.has(channel.id),
      subscriptionId: subscriptionMap.get(channel.id) ?? null
    }));

    // # Prisma Join
    // const channels =await this.db.channel.findMany({
    //   take: take,
    //   skip: cursor ? 1 : 0, // cursor 데이터 제외
    //   ...(cursor && { cursor: { id: cursor } }),
    //   orderBy: { [orderBy]: order },
    //   include: {
    //     subscription: {
    //       where: { userId },
    //       take: 1,
    //     },
    //   },
    // });
    //
    // return channels.map(channel => ({
    //   ...channel,
    //   isSubscribed: channel.subscription.length > 0,
    //   subscriptionId: channel.subscription[0]?.id ?? null,
    //   subscription: undefined, // 응답에서 제거
    // }));
  }

  /**
   * 채널 상세 조회 (공통 채널 정보)
   */
  async getChannelById({ channelId, userId }: { channelId: number; userId?: string }): Promise<ChannelResponseDto> {
    const channel = await this.db.channel.findUnique({
      where: { id: channelId }
    });
    if (!channel) {
      throw new CustomException('CHANNEL_NOT_FOUND');
    }

    // 구독 정보 조회
    const subscription = userId
      ? await this.db.subscription.findUnique({
          where: {
            userId_channelId: {
              userId,
              channelId
            }
          },
          select: { id: true }
        })
      : null;

    const isSubscribed = !!subscription;

    // 구독 중이면 태그 정보도 조회
    const tags =
      subscription && userId
        ? await this.tagsService.getTagsByTaggableId(userId, TaggableType.CHANNEL, subscription.id)
        : undefined;

    return {
      ...ChannelResponseDto.from(channel, isSubscribed),
      ...(tags && { tags })
    };
  }
}
