import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';

@Injectable()
export class PublicService {
  constructor(private readonly db: PrismaService) {}

  async getChannels() {
    return this.db.channel.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
  }

  async getChannelById(id: number) {
    const channel = await this.findUniqueChannelByChannelId(id);
    await this.validatePublicChannel(id);

    return channel;
  }

  async getChannelHistoryById(id: number) {
    await this.findUniqueChannelByChannelId(id);
    await this.validatePublicChannel(id);

    return this.db.channelHistory.findMany({
      where: { channelId: id },
      orderBy: { createdAt: 'asc' }
    });
  }

  private async findUniqueChannelByChannelId(id: number) {
    const channel = await this.db.channel.findUnique({
      where: { id }
    });

    if (!channel) {
      throw new CustomException('CHANNEL_NOT_FOUND');
    }
    return channel;
  }

  private async validatePublicChannel(id: number) {
    const publicChannels = await this.db.channel.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    });
    const isIncluded = publicChannels.some((channel) => channel.id === id);
    if (!isIncluded) {
      throw new CustomException('FORBIDDEN', { message: '최근 추가된 채널10개만 제공 됩니다.' });
    }
  }
}
