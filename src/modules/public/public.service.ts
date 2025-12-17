import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { ChannelsService } from '@/modules/channels/channels.service';

@Injectable()
export class PublicService {
  constructor(
    private readonly db: PrismaService,
    private readonly channelService: ChannelsService
  ) {}

  async getChannels() {
    return this.db.channel.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
  }

  async getChannelHistory(identifier: string) {
    const channel = await this.channelService.getChannel(identifier);

    const publicChannels = await this.getChannels();
    const channelIds = publicChannels.map((channel) => channel.id);

    if (!channelIds.includes(channel.id)) {
      throw new CustomException('BAD_REQUEST');
    }

    return this.db.channelHistory.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: 'asc' }
    });
  }
}
