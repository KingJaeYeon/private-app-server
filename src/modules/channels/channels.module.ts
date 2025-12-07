import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { ChannelsService } from './channels.service';
import { ChannelHistoriesService } from './channel-histories.service';
import { ChannelHistoriesHelperService } from './channel-histories-helper.service';
import { SubscriptionService } from './subscription.service';
import { SubscriptionHelperService } from './subscription-helper.service';
import { TagsModule } from '@/modules/tags/tags.module';
import { YoutubeModule } from '@/modules/youtube/youtube.module';
import { ChannelSchedulerService } from './channel-scheduler.service';

@Module({
  imports: [TagsModule, YoutubeModule],
  controllers: [ChannelsController, SubscriptionsController],
  providers: [
    ChannelsService,
    ChannelHistoriesService,
    ChannelHistoriesHelperService,
    SubscriptionService,
    SubscriptionHelperService,
    ChannelSchedulerService
  ],
  exports: [ChannelsService, ChannelHistoriesService, SubscriptionService]
})
export class ChannelsModule {}
