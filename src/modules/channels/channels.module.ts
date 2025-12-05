import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { ChannelHistoriesService } from '@/modules/channels/channel-histories.service';

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelHistoriesService]
})
export class ChannelsModule {}
