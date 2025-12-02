import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { ConfigKey, DbConfig } from '@/config/config.interface';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  constructor(configService: ConfigService<ConfigKey>) {
    const dbConfig: DbConfig = configService.getOrThrow('db');

    const pool = new PrismaPg({ connectionString: dbConfig.postgresql }, { schema: dbConfig.schema });
    super({ adapter: pool });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('📦 Database connected successfully');
    } catch (err) {
      this.logger.error('❌ Failed to connect to database', err);
      throw err; // 연결 실패 시 서버가 바로 죽어서 문제 원인 바로 확인 가능
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('📦 Database disconnect successfully');
    } catch (err) {
      this.logger.error('❌ Failed to disconnect to database', err);
      throw err; // 연결 실패 시 서버가 바로 죽어서 문제 원인 바로 확인 가능
    }
  }
}
