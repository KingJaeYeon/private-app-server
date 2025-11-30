import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ErrorLoggingService } from './error-logging.service';

@Global()
@Module({
  providers: [PrismaService, ErrorLoggingService],
  exports: [PrismaService, ErrorLoggingService],
})
export class CoreModule {}
