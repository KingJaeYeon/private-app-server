import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { ChannelsModule } from '@/modules/channels/channels.module';

@Module({
  imports: [ChannelsModule],
  controllers: [PublicController],
  providers: [PublicService]
})
export class PublicModule {}
