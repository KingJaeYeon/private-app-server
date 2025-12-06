export interface IConfigKey {
  db: IDbConfig;
  app: IAppConfig;
  jwt: IJWTConfig;
  apikey: IApiKeyConfig;
}

export interface IDbConfig {
  postgresql: string;
  schema: string;
}

export interface IJWTConfig {
  secret: string;
  expiresIn: number;
}

export interface IAppConfig {
  port: number;
  front: string;
  domain: string;
}

export interface IApiKeyConfig {
  youtube: string;
}
