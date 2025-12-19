import { Module, ValidationPipe } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { CoreModule } from '@/core/core.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '@/modules/users/users.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import configuration from '@/config/configuration';
import { AllExceptionsFilter } from '@/common/filters';
import { ResponseInterceptor, YoutubeApiUsageInterceptor } from '@/common/interceptors';
import { BlacklistGuard } from '@/common/guards/blacklist.guard';
import { YoutubeModule } from '@/modules/youtube/youtube.module';
import { TagsModule } from './modules/tags/tags.module';
import { ChannelsModule } from '@/modules/channels/channels.module';
import { ReferencesModule } from './modules/references/references.module';
import { PublicModule } from './modules/public/public.module';
import { TimingInterceptor } from '@/common/interceptors/timing.interceptor';
import { RedisModule } from './modules/redis/redis.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

const isDev = process.env.NODE_ENV === 'development';

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      isGlobal: true,
      load: [configuration]
    }),
    CoreModule,
    ThrottlerModule.forRoot([{ limit: 60, ttl: 60000, skipIf: () => isDev }]),
    UsersModule,
    AuthModule,
    TagsModule,
    ChannelsModule,
    ReferencesModule,
    YoutubeModule,
    PublicModule,
    RedisModule,
    SubscriptionsModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: BlacklistGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: YoutubeApiUsageInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: {
            enableImplicitConversion: true
          }
        })
    }
  ]
})
export class AppModule {}
