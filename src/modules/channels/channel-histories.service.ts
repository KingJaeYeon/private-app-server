import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';

@Injectable()
export class ChannelHistoriesService {
  constructor(private readonly db: PrismaService) {}

  // TODO: YouTube API호 db -> channels viewCount, videoCount, subscriptionCount Cron으로 쌓아야함
}
