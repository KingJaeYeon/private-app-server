import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(configService: ConfigService) {
    const pool = new PrismaPg({ connectionString: configService.get('database.url') });
    super({ adapter: pool });
  }

  async onModuleInit() {
    // Note: this is optional
    await this.$connect();
  }
}
