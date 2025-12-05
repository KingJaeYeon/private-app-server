import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { ERROR_CODES } from './common/exceptions';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'body-parser';
import { ConfigService } from '@nestjs/config';
import { AppConfig, ConfigKey } from '@/config/config.interface';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AUTH_COOKIE } from '@/common/constants/auth';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const swaggerDescription = readFileSync(join(__dirname, 'docs/swagger-description.md'), 'utf8');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet()); // 보안 헤더 자동 설정 (XSS, MIME sniffing, CSP 등)

  // Proxy 환경에서 IP/도메인 신뢰 (Nginx, Cloudflare 뒤에 있을 때 필요)
  app.set('trust proxy', true);

  app.use(cookieParser()); // Cookie 파싱

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ limit: '5mb', extended: true }));

  const config = app.get(ConfigService<ConfigKey>);
  const appConfig = config.getOrThrow<AppConfig>('app');

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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의된 프로퍼티만 허용 → 정의되지 않은 값 제거
      forbidNonWhitelisted: true, // whitelist에서 걸러진 “불필요 필드”가 존재하면 요청 자체를 거부 (보안성 ↑)
      transform: true, // 요청 데이터 타입을 DTO에 맞게 자동 변환 -> string → number 변환 등
      transformOptions: {
        enableImplicitConversion: true // DTO에서 암시적으로 타입 변환 허용
      },
      /**
       * ValidationPipe 가 오류를 생성할 때
       * 커스텀 HttpException 형태로 변환
       */
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => ({
          field: error.property,
          constraints: Object.values(error.constraints || {})
        }));

        return new HttpException(
          {
            success: false,
            code: ERROR_CODES.VALIDATION_ERROR.code,
            message: ERROR_CODES.VALIDATION_ERROR.message,
            details: messages
          },
          HttpStatus.BAD_REQUEST
        );
      }
    })
  );

  // CORS 설정 (클라이언트 도메인만 허용)
  app.enableCors({
    origin: [appConfig.front].filter(Boolean),
    credentials: true // Cookie 포함 요청 허용
  });

  await app.listen(appConfig.port ?? 3000);

  console.log(`🚀 Server: http://localhost:${appConfig.port}`);
  console.log(`📚 Swagger: http://localhost:${appConfig.port}/swagger`);
}

bootstrap();
