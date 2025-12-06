import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { YoutubeService } from './youtube.service';
import { YoutubeHelperService } from './youtube-helper.service';
import { YoutubeApiKeyService } from './youtube-api-key.service';
import { YoutubeSchedulerService } from './youtube-scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [YoutubeService, YoutubeHelperService, YoutubeApiKeyService, YoutubeSchedulerService],
  exports: [YoutubeService, YoutubeApiKeyService]
})
export class YoutubeModule {}

