import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
// import { ChannelHistoriesService } from './channel-histories.service';
// import { ChannelHistoriesHelperService } from './channel-histories-helper.service';
import { TagsModule } from '@/modules/tags/tags.module';
import { YoutubeModule } from '@/modules/youtube/youtube.module';

@Module({
  imports: [TagsModule, YoutubeModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService]
})
export class ChannelsModule {}
