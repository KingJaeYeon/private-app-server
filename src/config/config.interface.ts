export interface ConfigKey {
  db: DbConfig;
  app: AppConfig;
  jwt: JWTConfig;
}

export interface DbConfig {
  postgresql: string;
}

export interface JWTConfig {
  secret: string;
  expiresIn: number;
}

export interface AppConfig {
  port: number;
  front: string;
  domain: string;
}
