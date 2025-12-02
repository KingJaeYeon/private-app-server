import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { CoreModule } from '@/core/core.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '@/modules/users/users.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import configuration from '@/config/configuration';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from '@/common/filters';
import { ResponseInterceptor } from '@/common/interceptors';
import { BlacklistGuard } from '@/common/guards/blacklist.guard';

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
    AuthModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: BlacklistGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor }
  ]
})
export class AppModule {}
