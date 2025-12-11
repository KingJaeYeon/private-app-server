import type ms from 'ms';

export interface IConfigKey {
  db: IDbConfig;
  app: IAppConfig;
  jwt: IJWTConfig;
  apikey: IApiKeyConfig;
  nodeEnv: string;
}

export interface IDbConfig {
  postgresql: string;
  schema: string;
}

export interface IJWTConfig {
  authorization: {
    secret: string;
    expiresIn: ms.StringValue | number;
  };
  refresh: {
    secret: string;
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
}
