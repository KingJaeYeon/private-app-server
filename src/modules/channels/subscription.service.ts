import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { SubscribeChannelDto, UpdateSubscriptionDto, SubscriptionResponseDto, ChannelResponseDto } from './dto';
import { TaggableType } from '@generated/prisma/client';
import { SubscriptionsQueryDto } from '@/modules/channels/dto/channel-query.dto';
import { BulkUnsubscribeResponseDto } from '@/modules/channels/dto/unsubscribe-channel.dto';
import { TagsService } from '@/modules/tags/tags.service';
import { YoutubeService } from '@/modules/youtube/youtube.service';
import { SubscriptionHelperService } from './subscription-helper.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly db: PrismaService,
    private readonly tagsService: TagsService,
    private readonly youtubeService: YoutubeService,
    private readonly helperService: SubscriptionHelperService
  ) {}

  /**
   * 사용자의 구독 목록 조회 (태그 포함)
   */
  async getSubscriptions(query: SubscriptionsQueryDto, userId: string): Promise<SubscriptionResponseDto[]> {
    const { tagIds, orderBy, order, cursor, take, mode } = query;

    // 1. 태그 필터링 (있을 경우)
    let filteredSubscriptionIds: number[] | undefined;

    if (tagIds?.length) {
      // 단일 쿼리로 모든 태그 관계 조회 (태그 개수만큼 쿼리 반복 방지)
      const relations = await this.db.tagRelation.findMany({
        where: {
          userId,
          taggableType: TaggableType.CHANNEL,
          tagId: { in: tagIds }
        },
        select: { taggableId: true, tagId: true }
      });

      if (relations.length === 0) {
        return [];
      }

      // 구독 ID별로 태그 ID Set 관리 (O(n) 연산을 위해)
      const subscriptionTagMap = new Map<number, Set<number>>();
      for (const { taggableId, tagId } of relations) {
        if (!subscriptionTagMap.has(taggableId)) {
          subscriptionTagMap.set(taggableId, new Set());
        }
        subscriptionTagMap.get(taggableId)!.add(tagId);
      }

      // mode에 따라 필터링
      if (mode === 'and') {
        // AND 모드: 모든 태그가 포함된 구독만 (교집합) - O(n) 연산
        filteredSubscriptionIds = Array.from(subscriptionTagMap.entries())
          .filter(([_, tagSet]) => tagIds.every((id) => tagSet.has(id)))
          .map(([id]) => id);
      } else {
        // OR 모드: 하나라도 포함된 구독 (합집합)
        filteredSubscriptionIds = Array.from(subscriptionTagMap.keys());
      }

      // 필터링 결과가 없으면 빈 배열 반환 (DB 부하 줄임)
      if (filteredSubscriptionIds.length === 0) {
        return [];
      }
    }

    // 2. 구독 페이지네이션 조회
    const subscriptions = await this.db.subscription.findMany({
      where: {
        userId,
        ...(filteredSubscriptionIds && { id: { in: filteredSubscriptionIds } })
      },
      orderBy: { [orderBy]: order },
      take: take || 20,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: { channel: true }
    });

    if (subscriptions.length === 0) {
      return [];
    }

    // 3. 태그 관계 배치 조회 (N+1 방지)
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

    // 4. 구독 ID별로 태그 그룹화
    const tagsBySubscriptionId = new Map<number, typeof tagRelations>();
    for (const relation of tagRelations) {
      const existing = tagsBySubscriptionId.get(relation.taggableId) || [];
      existing.push(relation);
      tagsBySubscriptionId.set(relation.taggableId, existing);
    }

    // 5. 최종 매핑
    return subscriptions.map((subscription) => ({
      id: subscription.id,
      channel: ChannelResponseDto.from(subscription.channel),
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
   * 채널 구독 (배치)
   * 기존 채널이면 구독만 추가, 새 채널이면 생성 후 구독
   */
  async subscribeChannel(userId: string, dto: SubscribeChannelDto): Promise<SubscriptionResponseDto[]> {
    // 1. 모든 handle에 대해 채널 찾기 (handle 또는 channelId로)
    const channels = await this.db.channel.findMany({
      where: {
        OR: dto.handles.flatMap((handle) => [
          { handle },
          { channelId: handle }
        ])
      }
    });

    // 2. 찾지 못한 채널 확인
    const foundHandles = new Set(channels.flatMap((c) => [c.handle, c.channelId].filter(Boolean)));
    const notFoundHandles = dto.handles.filter((handle) => !foundHandles.has(handle));

    // 2-1. 찾지 못한 채널은 YouTube API로 조회 및 생성
    if (notFoundHandles.length > 0) {
      const youtubeChannels = await this.youtubeService.fetchChannelsByHandle(notFoundHandles);
      const createdChannels = await this.youtubeService.createChannelsFromYouTube(youtubeChannels);
      channels.push(...createdChannels);
    }

    // 3. 이미 구독 중인 채널 확인
    const channelIds = channels.map((c) => c.id);
    const existingSubscriptions = await this.db.subscription.findMany({
      where: {
        userId,
        channelId: { in: channelIds }
      },
      select: { channelId: true }
    });

    const subscribedChannelIds = new Set(existingSubscriptions.map((s) => s.channelId));
    const newChannelIds = channelIds.filter((id) => !subscribedChannelIds.has(id));

    if (newChannelIds.length === 0) {
      throw new CustomException('ALREADY_SUBSCRIBED');
    }

    // 4. 구독 일괄 생성 (트랜잭션 사용)
    const createdSubscriptions = await this.db.$transaction(async (tx) => {
      // 구독 생성
      await tx.subscription.createMany({
        data: newChannelIds.map((channelId) => ({
          userId,
          channelId
        })),
        skipDuplicates: true
      });

      // 생성된 구독 조회 (태그 없이)
      return tx.subscription.findMany({
        where: {
          userId,
          channelId: { in: newChannelIds }
        },
        include: {
          channel: true
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    // 5. 태그 없이 반환 (내 구독목록으로 넣을 때는 태그 안 넣음)
    return createdSubscriptions.map((subscription) => ({
      id: subscription.id,
      channel: ChannelResponseDto.from(subscription.channel, true),
      tags: [],
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt
    }));
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
      await this.helperService.attachTagsToSubscription(userId, subscriptionId, dto.tagIds);
    }

    return this.getSubscriptionById(userId, subscriptionId);
  }

  /**
   * 구독 취소
   */
  async unsubscribeChannels(userId: string, subscriptionIds: number[]): Promise<BulkUnsubscribeResponseDto> {
    return this.db.$transaction(async (tx) => {
      // 1. 유효한 구독 조회 (소유권 포함)
      const subscriptions = await tx.subscription.findMany({
        where: {
          id: { in: subscriptionIds },
          userId
        },
        select: { id: true }
      });

      const validIds = subscriptions.map((s) => s.id);
      const foundIdsSet = new Set(validIds);
      const failedIds = subscriptionIds.filter((id) => !foundIdsSet.has(id));

      if (validIds.length === 0) {
        // 유효한 구독이 하나도 없다면 실패
        throw new CustomException('SUBSCRIPTION_NOT_FOUND');
      }

      // 2. 태그 관계 조회 (감소량 계산)
      const tagRelations = await tx.tagRelation.findMany({
        where: {
          userId,
          taggableType: TaggableType.CHANNEL,
          taggableId: { in: validIds }
        },
        select: { tagId: true }
      });

      // tagId별 감소 횟수 집계
      const tagIdCounts = tagRelations.reduce((acc, { tagId }) => {
        acc.set(tagId, (acc.get(tagId) || 0) + 1);
        return acc;
      }, new Map<number, number>());

      // 3. 태그 관계 삭제
      if (tagRelations.length > 0) {
        await tx.tagRelation.deleteMany({
          where: {
            userId,
            taggableType: TaggableType.CHANNEL,
            taggableId: { in: validIds }
          }
        });
      }

      // 4. 태그 usageCount 개별 감소 (정확도 💯)
      await Promise.all(
        Array.from(tagIdCounts.entries()).map(([tagId, count]) =>
          tx.tag.update({
            where: { id: tagId },
            data: { usageCount: { decrement: count } }
          })
        )
      );

      // 5. 구독 삭제
      const deleted = await tx.subscription.deleteMany({
        where: { id: { in: validIds } }
      });

      return {
        deleted: deleted.count,
        deletedIds: validIds,
        failedIds
      };
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
    const tags = await this.tagsService.getTagsByTaggableId(userId, TaggableType.CHANNEL, subscriptionId);

    return {
      id: subscription.id,
      channel: ChannelResponseDto.from(subscription.channel),
      tags,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt
    };
  }
}
