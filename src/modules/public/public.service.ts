import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { ChannelBaseResponseDto } from '@/modules/channels/dto';
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

  async getChannelById(channelId: number) {
    const channel = await this.db.channel.findUnique({
      where: { id: channelId }
    });

    if (!channel) {
      throw new CustomException('CHANNEL_NOT_FOUND');
    }

    const publicChannels = await this.db.channel.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    });

    const isIncluded = publicChannels.every((channel) => channel.id === channelId);
    if (!isIncluded) {
      throw new CustomException('FORBIDDEN', { message: '최근 추가된 채널10개만 제공 됩니다.' });
    }

    return channel;
  }
}
