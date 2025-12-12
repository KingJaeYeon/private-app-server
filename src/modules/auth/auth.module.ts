import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthHelperService } from './auth-helper.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { VerifyEmailService } from '@/modules/auth/verify-email.service';
import { UsersModule } from '@/modules/users/users.module';
import { TokenService } from '@/modules/auth/token.service';

@Module({
  imports: [
    JwtModule,
    PassportModule,
    UsersModule
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthHelperService, JwtStrategy, VerifyEmailService, TokenService],
  exports: [AuthService]
})
export class AuthModule {}
