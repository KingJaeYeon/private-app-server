import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { ConfigKey, DbConfig } from '@/config/config.interface';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(configService: ConfigService<ConfigKey>) {
    const dbConfig: DbConfig = configService.getOrThrow('db');

    const pool = new PrismaPg({ connectionString: dbConfig.postgresql });
    super({ adapter: pool });
  }

  async onModuleInit() {
    // Note: this is optional
    await this.$connect();
  }
}
