import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { IConfigKey, IDbConfig } from '@/config/config.interface';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService<IConfigKey>) => {
        const dbConfig: IDbConfig = configService.getOrThrow('db');
        return new Redis({
          host: dbConfig.redis.host,
          port: dbConfig.redis.port
        });
      },
      inject: [ConfigService]
    }
  ]
})
export class RedisModule {}
