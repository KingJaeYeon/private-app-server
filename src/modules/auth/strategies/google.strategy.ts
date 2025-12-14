// src/auth/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { IApiKeyConfig, IConfigKey } from '@/config/config.interface';
import { Provider } from '@generated/prisma/enums';
import { UsersService } from '@/modules/users/users.service';
import { CustomException } from '@/common/exceptions';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService<IConfigKey>,
    private readonly userService: UsersService
  ) {
    const apikey: IApiKeyConfig = configService.getOrThrow('apikey');
    super({
      clientID: apikey.google.clientId,
      clientSecret: apikey.google.secret,
      callbackURL: apikey.google.callbackURL,
      scope: ['email', 'profile']
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    const { _json } = profile;
    const email = _json.email;

    if (!email) {
      throw new CustomException('NOT_FOUND');
    }

    return this.userService.getOrCreateOAuthUser({
      email,
      username: email.split('@')[0],
      provider: Provider.GOOGLE,
      providerId: _json.sub,
      profileUrl: _json.picture
    });
  }

  authorizationParams(options: any): object {
    options['prompt'] = 'select_account';
    return options;
  }
}
