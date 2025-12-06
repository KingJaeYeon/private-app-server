import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { TaggableType } from '@generated/prisma/client';

@Injectable()
export class SubscriptionHelperService {
  constructor(private readonly db: PrismaService) {}

  /**
   * 구독에 태그 연결 (내부 메서드)
   */
  async attachTagsToSubscription(userId: string, subscriptionId: number, tagIds: number[]): Promise<void> {
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
}

