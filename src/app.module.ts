import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { CoreModule } from '@/core/core.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '@/modules/users/users.module';
import { AuthModule } from '@/modules/auth/auth.module';

const isDev = process.env.NODE_ENV === 'development';
console.log('isDve', isDev);
@Module({
  imports: [
    CoreModule,
    ThrottlerModule.forRoot([
      { name: 'default', limit: 60, ttl: 60000, skipIf: () => isDev },
      { name: 'short', ttl: 1000, limit: 3, skipIf: () => isDev },
      { name: 'medium', ttl: 10000, limit: 20, skipIf: () => isDev },
      { name: 'long', ttl: 60000, limit: 100, skipIf: () => isDev }
    ]),
    UsersModule,
    AuthModule
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
