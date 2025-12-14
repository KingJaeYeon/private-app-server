import type ms from 'ms';

export interface IConfigKey {
  db: IDbConfig;
  app: IAppConfig;
  jwt: IJWTConfig;
  apikey: IApiKeyConfig;
  nodeEnv: string;
}

export interface IDbConfig {
  postgresql: {
    url: string;
    schema: string;
  };
  redis: {
    host: string;
    port: number;
  };
}

export interface IJWTConfig {
  access: {
    secret: string;
    expiresIn: ms.StringValue | number;
  };
  refresh: {
    expiresIn: ms.StringValue | number;
  };
}

export interface IAppConfig {
  port: number;
  front: string;
  domain: string;
}

export interface IApiKeyConfig {
  youtube: string;
  google: {
    clientId: string;
    secret: string;
    callbackURL: string;
  };
}
