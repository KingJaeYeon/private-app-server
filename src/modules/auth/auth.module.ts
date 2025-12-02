import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConfigKey, JWTConfig } from '@/config/config.interface';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { VerifyEmailService } from '@/modules/auth/verify-email.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService<ConfigKey>) => {
        const jwt: JWTConfig = configService.getOrThrow('jwt');
        return {
          secret: jwt.secret,
          signOptions: {
            expiresIn: jwt.expiresIn
          }
        };
      }
    }),
    PassportModule
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, VerifyEmailService],
  exports: [AuthService]
})
export class AuthModule {}
