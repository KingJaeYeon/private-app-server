import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { SubscribeChannelDto, UpdateSubscriptionDto, SubscriptionResponseDto, ChannelResponseDto } from './dto';
import { Channel, TaggableType } from '@generated/prisma/client';
import { ChannelQueryDto } from '@/modules/channels/dto/channel-query.dto';

@Injectable()
export class ChannelsService {
  constructor(private readonly db: PrismaService) {}

  /**
   * 사용자의 구독 목록 조회 (태그 포함)
   */
  async getSubscriptions(userId: string): Promise<SubscriptionResponseDto[]> {
    // 1. 사용자의 구독 목록 조회
    const subscriptions = await this.db.subscription.findMany({
      where: { userId },
      include: {
        channel: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (subscriptions.length === 0) {
      return [];
    }

    // 2. 구독 ID 배열로 태그 관계 배치 조회 (N+1 방지)
    const subscriptionIds = subscriptions.map((s) => s.id);
    const tagRelations = await this.db.tagRelation.findMany({
      where: {
        userId,
        taggableType: TaggableType.CHANNEL,
        taggableId: { in: subscriptionIds }
      },
      include: {
        tag: true
      }
    });

    // 3. 구독 ID별로 태그 그룹화
    const tagsBySubscriptionId = new Map<number, typeof tagRelations>();
    for (const relation of tagRelations) {
      const existing = tagsBySubscriptionId.get(relation.taggableId) || [];
      existing.push(relation);
      tagsBySubscriptionId.set(relation.taggableId, existing);
    }

    // 4. 구독에 태그 매핑
    return subscriptions.map((subscription) => ({
      id: subscription.id,
      channel: this.mapChannelToDto(subscription.channel),
      tags: (tagsBySubscriptionId.get(subscription.id) || []).map((r) => ({
        id: r.tag.id,
        name: r.tag.name,
        slug: r.tag.slug
      })),
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt
    }));
  }

  /**
   * 채널 구독
   * 기존 채널이면 구독만 추가, 새 채널이면 생성 후 구독
   */
  async subscribeChannel(userId: string, dto: SubscribeChannelDto): Promise<SubscriptionResponseDto> {
    // TODO: YouTube API 연동하여 채널 정보 가져오기
    // 현재는 handle로 기존 채널 찾기만 구현

    // 1. 기존 채널 찾기 (handle 또는 channelId로)
    let channel = await this.db.channel.findFirst({
      where: {
        OR: [{ handle: dto.handle }, { channelId: dto.handle }]
      }
    });

    // 2. 채널이 없으면 생성 (YouTube API 연동 필요)
    if (!channel) {
      // TODO: YouTube API로 채널 정보 가져와서 생성
      throw new CustomException('CHANNEL_NOT_FOUND', { handle: dto.handle });
    }

    // 3. 이미 구독 중인지 확인
    const existingSubscription = await this.db.subscription.findUnique({
      where: {
        userId_channelId: {
          userId,
          channelId: channel.id
        }
      }
    });

    if (existingSubscription) {
      throw new CustomException('ALREADY_SUBSCRIBED', { channelId: channel.id });
    }

    // 4. 구독 생성
    const subscription = await this.db.subscription.create({
      data: {
        userId,
        channelId: channel.id
      },
      include: {
        channel: true
      }
    });

    // 5. 태그 연결 (있는 경우)
    if (dto.tagIds && dto.tagIds.length > 0) {
      await this.attachTagsToSubscription(userId, subscription.id, dto.tagIds);
    }

    // 6. 태그 포함하여 반환
    return this.getSubscriptionById(userId, subscription.id);
  }

  /**
   * 구독 업데이트 (태그 추가/제거)
   */
  async updateSubscription(
    userId: string,
    subscriptionId: number,
    dto: UpdateSubscriptionDto
  ): Promise<SubscriptionResponseDto> {
    // 1. 구독 존재 확인
    const subscription = await this.db.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId
      }
    });

    if (!subscription) {
      throw new CustomException('SUBSCRIPTION_NOT_FOUND', { subscriptionId });
    }

    // 2. 기존 태그 관계 조회 및 삭제 (usageCount 감소를 위해)
    const existingRelations = await this.db.tagRelation.findMany({
      where: {
        userId,
        taggableType: TaggableType.CHANNEL,
        taggableId: subscriptionId
      }
    });

    const existingTagIds = existingRelations.map((r) => r.tagId);

    // 기존 태그 관계 삭제
    await this.db.tagRelation.deleteMany({
      where: {
        userId,
        taggableType: TaggableType.CHANNEL,
        taggableId: subscriptionId
      }
    });

    // 기존 태그의 usageCount 감소
    if (existingTagIds.length > 0) {
      await this.db.tag.updateMany({
        where: { id: { in: existingTagIds } },
        data: {
          usageCount: { decrement: 1 }
        }
      });
    }

    // 3. 새 태그 연결 (있는 경우)
    if (dto.tagIds && dto.tagIds.length > 0) {
      await this.attachTagsToSubscription(userId, subscriptionId, dto.tagIds);
    }

    return this.getSubscriptionById(userId, subscriptionId);
  }

  /**
   * 구독 취소
   */
  async unsubscribeChannel(userId: string, subscriptionId: number): Promise<void> {
    // 1. 구독 존재 확인
    const subscription = await this.db.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId
      }
    });

    if (!subscription) {
      throw new CustomException('SUBSCRIPTION_NOT_FOUND', { subscriptionId });
    }

    // 2. 태그 관계 조회 (usageCount 감소를 위해)
    const tagRelations = await this.db.tagRelation.findMany({
      where: {
        userId,
        taggableType: TaggableType.CHANNEL,
        taggableId: subscriptionId
      }
    });

    const tagIds = tagRelations.map((r) => r.tagId);

    // 태그 관계 삭제
    await this.db.tagRelation.deleteMany({
      where: {
        userId,
        taggableType: TaggableType.CHANNEL,
        taggableId: subscriptionId
      }
    });

    // 태그의 usageCount 감소
    if (tagIds.length > 0) {
      await this.db.tag.updateMany({
        where: { id: { in: tagIds } },
        data: {
          usageCount: { decrement: 1 }
        }
      });
    }

    // 3. 구독 삭제
    await this.db.subscription.delete({
      where: { id: subscriptionId }
    });
  }

  /**
   * 구독 상세 조회
   */
  async getSubscriptionById(userId: string, subscriptionId: number): Promise<SubscriptionResponseDto> {
    const subscription = await this.db.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId
      },
      include: {
        channel: true
      }
    });

    if (!subscription) {
      throw new CustomException('SUBSCRIPTION_NOT_FOUND', { subscriptionId });
    }

    // 태그 조회
    const tagRelations = await this.db.tagRelation.findMany({
      where: {
        userId,
        taggableType: TaggableType.CHANNEL,
        taggableId: subscriptionId
      },
      include: {
        tag: true
      }
    });

    return {
      id: subscription.id,
      channel: this.mapChannelToDto(subscription.channel),
      tags: tagRelations.map((r) => ({
        id: r.tag.id,
        name: r.tag.name,
        slug: r.tag.slug
      })),
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt
    };
  }

  /**
   * 채널 상세 조회 (공통 채널 정보)
   */
  async getChannelById(channelId: number): Promise<ChannelResponseDto> {
    const channel = await this.db.channel.findUnique({
      where: { id: channelId }
    });

    if (!channel) {
      throw new CustomException('CHANNEL_NOT_FOUND', { channelId });
    }

    return this.mapChannelToDto(channel);
  }

  /**
   * 채널 목록 조회 (공통 채널, 검색 가능)
   */
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
      orderBy: { [orderBy]: order },
    });

    // 한 번의 쿼리로 구독 상태 가져오기
    const channelIds = channels.map(c => c.id);
    const subscriptions = await this.db.subscription.findMany({
      where: {
        userId,
        channelId: { in: channelIds },
      },
      select: { id: true, channelId: true },
    });

    // Map으로 빠르게 매핑
    const subscriptionMap = new Map(
      subscriptions.map(s => [s.channelId, s.id])
    );

    // 결과 조합
    return channels.map(channel => ({
      ...channel,
      isSubscribed: subscriptionMap.has(channel.id),
      subscriptionId: subscriptionMap.get(channel.id) ?? null,
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
   * 구독에 태그 연결 (내부 메서드)
   */
  private async attachTagsToSubscription(userId: string, subscriptionId: number, tagIds: number[]): Promise<void> {
    // 태그 존재 확인
    const tags = await this.db.tag.findMany({
      where: { id: { in: tagIds } }
    });

    if (tags.length !== tagIds.length) {
      const foundIds = tags.map((t) => t.id);
      const notFoundIds = tagIds.filter((id) => !foundIds.includes(id));
      throw new CustomException('TAG_NOT_FOUND', { tagIds: notFoundIds });
    }

    // 태그 관계 생성
    await this.db.tagRelation.createMany({
      data: tagIds.map((tagId) => ({
        userId,
        tagId,
        taggableType: TaggableType.CHANNEL,
        taggableId: subscriptionId
      })),
      skipDuplicates: true
    });

    // 태그 사용 카운트 업데이트
    await this.db.tag.updateMany({
      where: { id: { in: tagIds } },
      data: {
        usageCount: { increment: 1 }
      }
    });
  }

  /**
   * Channel 모델을 DTO로 변환
   */
  private mapChannelToDto(channel: any): ChannelResponseDto {
    return {
      id: channel.id,
      channelId: channel.channelId,
      name: channel.name,
      handle: channel.handle,
      description: channel.description,
      link: channel.link,
      thumbnailUrl: channel.thumbnailUrl,
      regionCode: channel.regionCode,
      defaultLanguage: channel.defaultLanguage,
      videoCount: channel.videoCount,
      viewCount: channel.viewCount.toString(), // BigInt를 문자열로
      subscriberCount: channel.subscriberCount,
      publishedAt: channel.publishedAt,
      lastVideoUploadedAt: channel.lastVideoUploadedAt,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
      isSubscribed: false
    };
  }
}
