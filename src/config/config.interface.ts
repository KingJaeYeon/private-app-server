export interface ConfigKey {
  db: DbConfig;
  app: AppConfig;
}

export interface DbConfig {
  postgresql: string;
}

export interface AppConfig {
  port: number;
  front: string;
}
