import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { Channel, Prisma, TaggableType } from '@generated/prisma/client';
import { ChannelQueryDto } from '@/modules/channels/dto/channel-query.dto';
import { TagsService } from '@/modules/tags/tags.service';
import { ChannelResponseDto, SuggestResponseDto, ChannelListResponseDto } from '@/modules/channels/dto/response.dto';
import { ChannelListDto } from '@/modules/channels/dto/request.dto';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly db: PrismaService,
    private readonly tagsService: TagsService
  ) {}

  async getChannel(identifier: string) {
    const channel = await this.db.channel.findFirst({
      where: {
        OR: [{ channelId: identifier }, { handle: identifier }]
      }
    });

    if (!channel) {
      throw new CustomException('CHANNEL_NOT_FOUND');
    }

    return channel;
  }

  async getChannels(params: ChannelListDto): Promise<ChannelListResponseDto> {
    const { dailyViewCount, sort, country, subscriber, uploadAt, q, userId, cursor, limit } = params;
    const and: Prisma.ChannelWhereInput[] = [];

    // 검색어 필터 (채널명)
    if (q) {
      and.push({
        name: {
          contains: q,
          mode: 'insensitive'
        }
      });
    }

    // 국가 필터
    if (country && country.length > 0) {
      and.push({
        regionCode: {
          in: country
        }
      });
    }

    // 구독자 수 필터
    if (subscriber && subscriber.length > 0) {
      const subscriberConditions: Prisma.ChannelWhereInput[] = subscriber.map((sub) => {
        switch (sub) {
          case '10K_under':
            return { subscriberCount: { lt: 10000 } };
          case '10K_100K':
            return { subscriberCount: { gte: 10000, lt: 100000 } };
          case '100K_500K':
            return { subscriberCount: { gte: 100000, lt: 500000 } };
          case '500K_1M':
            return { subscriberCount: { gte: 500000, lt: 1000000 } };
          case '1M_over':
            return { subscriberCount: { gte: 1000000 } };
          default:
            return {};
        }
      });
      and.push({ OR: subscriberConditions });
    }

    // 일일 조회수 필터
    if (dailyViewCount && dailyViewCount.length > 0) {
      const viewCountConditions: Prisma.ChannelWhereInput[] = dailyViewCount.map((view) => {
        switch (view) {
          case '100K_under':
            return { dailyViewCount: { lt: 100000 } };
          case '100K_1M':
            return { dailyViewCount: { gte: 100000, lt: 1000000 } };
          case '1M_over':
            return { dailyViewCount: { gte: 1000000 } };
          default:
            return {};
        }
      });
      and.push({ OR: viewCountConditions });
    }

    // 마지막 업로드 기간 필터
    if (uploadAt && uploadAt !== 'all') {
      const now = new Date();
      let daysAgo: number;
      switch (uploadAt) {
        case '7d':
          daysAgo = 7;
          break;
        case '14d':
          daysAgo = 14;
          break;
        case '1m':
          daysAgo = 30;
          break;
        case '2m':
          daysAgo = 60;
          break;
        case '3m':
          daysAgo = 90;
          break;
        case '6m':
          daysAgo = 180;
          break;
        case '1y':
          daysAgo = 365;
          break;
        default:
          daysAgo = 0;
      }
      const dateThreshold = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      and.push({
        lastVideoUploadedAt: {
          gte: dateThreshold
        }
      });
    }

    // 정렬 기준
    const orderBy: Prisma.ChannelOrderByWithRelationInput = {
      [sort || 'createdAt']: 'desc'
    };

    const takeLimit = (limit || 20) + 1; // hasNext 확인을 위해 +1

    // 채널 조회 (limit + 1개)
    const channels = await this.db.channel.findMany({
      where: {
        AND: and.length > 0 ? and : undefined
      },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1
          }
        : {}),
      take: takeLimit,
      orderBy
    });

    // hasNext 확인 및 nextCursor 계산
    const nextCursor = channels.length ? channels[channels.length - 1].id : null;
    // userId가 있으면 구독 정보 포함
    if (userId) {
      const channelIds = channels.map((c) => c.id);
      const subscriptions = await this.db.subscription.findMany({
        where: {
          userId,
          channelId: { in: channelIds }
        },
        select: { id: true, channelId: true }
      });

      const subscriptionMap = new Map(subscriptions.map((s) => [s.channelId, s.id]));

      // 구독 중인 채널의 태그 정보 조회
      const subscriptionIds = subscriptions.map((s) => s.id);
      const tagRelations =
        subscriptionIds.length > 0
          ? await this.db.tagRelation.findMany({
              where: {
                userId,
                taggableType: TaggableType.CHANNEL,
                taggableId: { in: subscriptionIds }
              },
              include: {
                tag: {
                  select: {
                    id: true,
                    name: true,
                    slug: true
                  }
                }
              }
            })
          : [];

      const tagsMap = new Map<number, Array<{ id: number; name: string; slug: string }>>();
      for (const relation of tagRelations) {
        const subscriptionId = relation.taggableId;
        if (!tagsMap.has(subscriptionId)) {
          tagsMap.set(subscriptionId, []);
        }
        tagsMap.get(subscriptionId)!.push({
          id: relation.tag.id,
          name: relation.tag.name,
          slug: relation.tag.slug
        });
      }

      const data = channels.map((channel) => {
        const subscriptionId = subscriptionMap.get(channel.id);
        const isSubscribed = !!subscriptionId;
        const tags = subscriptionId ? tagsMap.get(subscriptionId) : undefined;

        return {
          ...ChannelResponseDto.from(channel, isSubscribed),
          ...(tags && { tags })
        };
      });

      return {
        data,
        nextCursor
      };
    }

    // userId가 없으면 구독 정보 없이 반환
    const data = channels.map((channel) => ChannelResponseDto.from(channel, false));

    return {
      data,
      nextCursor
    };
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

  async getChannelSuggest(keyword: string): Promise<SuggestResponseDto[]> {
    return this.db.channel.findMany({
      take: 10,
      where: { name: { contains: keyword } },
      orderBy: { subscriberCount: 'desc' },
      select: {
        channelId: true,
        subscriberCount: true,
        thumbnailUrl: true,
        name: true
      }
    });
  }
}
