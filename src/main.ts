import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { ERROR_CODES } from './common/exceptions';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'body-parser';
import { ConfigService } from '@nestjs/config';
import { IAppConfig, IConfigKey } from '@/config/config.interface';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AUTH_COOKIE } from '@/common/constants/auth';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TimingInterceptor } from '@/common/interceptors/timing.interceptor';

const swaggerDescription = readFileSync(join(__dirname, 'docs/swagger-description.md'), 'utf8');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet()); // 보안 헤더 자동 설정 (XSS, MIME sniffing, CSP 등)

  // Proxy 환경에서 IP/도메인 신뢰 (Nginx, Cloudflare 뒤에 있을 때 필요)
  app.set('trust proxy', true);

  app.use(cookieParser()); // Cookie 파싱

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ limit: '5mb', extended: true }));

  const config = app.get(ConfigService<IConfigKey>);
  const appConfig = config.getOrThrow<IAppConfig>('app');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Private App API')
    .setDescription(swaggerDescription)
    .setVersion('1.0')
    .addCookieAuth(AUTH_COOKIE.ACCESS, { type: 'apiKey', in: 'cookie' }, AUTH_COOKIE.ACCESS)
    .addCookieAuth(AUTH_COOKIE.REFRESH, { type: 'apiKey', in: 'cookie' }, AUTH_COOKIE.REFRESH)
    .addServer(`http://localhost:${appConfig.port}`, 'Local')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('swagger', app, document, {
    jsonDocumentUrl: 'swagger/json',
    yamlDocumentUrl: 'swagger/yaml'
  });

  // CORS 설정 (클라이언트 도메인만 허용)
  app.enableCors({
    origin: [appConfig.front].filter(Boolean),
    credentials: true // Cookie 포함 요청 허용
  });

  await app.listen(appConfig.port ?? 3000);

  app.useGlobalInterceptors(new TimingInterceptor());

  console.log(`🚀 Server: http://localhost:${appConfig.port}`);
  console.log(`📚 Swagger: http://localhost:${appConfig.port}/swagger`);
}

bootstrap();
