import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ErrorLoggingService } from './error-logging.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useClass: PrismaService
    },
    PrismaService, // 기존 코드 호환성을 위해 유지
    ErrorLoggingService
  ],
  exports: [PrismaService, ErrorLoggingService]
})
export class CoreModule {}
