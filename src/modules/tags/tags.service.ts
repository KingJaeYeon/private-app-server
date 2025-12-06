import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { TaggableType } from '@generated/prisma/client';

export interface ITagDto {
  id: number;
  name: string;
  slug: string;
}

@Injectable()
export class TagsService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Taggable 엔티티에 연결된 태그 조회
   */
  async getTagsByTaggableId(
    userId: string,
    taggableType: TaggableType,
    taggableId: number
  ): Promise<ITagDto[]> {
    const tagRelations = await this.db.tagRelation.findMany({
      where: {
        userId,
        taggableType,
        taggableId
      },
      select: {
        tag: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    return tagRelations.map((r) => r.tag);
  }
}
