import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { ChannelHistoriesService } from './channel-histories.service';

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelHistoriesService],
  exports: [ChannelsService, ChannelHistoriesService]
})
export class ChannelsModule {}
