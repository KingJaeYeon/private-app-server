import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { ErrorLoggingService } from '@/core/error-logging.service';
import { HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { ERROR_CODES } from './common/exceptions';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'body-parser';
import { AllExceptionsFilter } from '@/common/filters';
import { ResponseInterceptor } from '@/common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet()); // 보안 헤더 자동 설정 (XSS, MIME sniffing, CSP 등)

  // Proxy 환경에서 IP/도메인 신뢰 (Nginx, Cloudflare 뒤에 있을 때 필요)
  app.set('trust proxy', true);

  app.use(cookieParser()); // Cookie 파싱

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ limit: '5mb', extended: true }));

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

  // 1. Error를 통합 처리 (HttpException + Prisma + Unknown)
  const errorLoggingService = app.get(ErrorLoggingService);
  app.useGlobalFilters(new AllExceptionsFilter(errorLoggingService));

  // 2. 모든 정상 응답을 성공 표준 포맷으로 변환
  app.useGlobalInterceptors(new ResponseInterceptor());

  // CORS 설정 (클라이언트 도메인만 허용)
  app.enableCors({
    origin: [process.env.FRONTEND_URL!, 'http://localhost:3000'].filter(Boolean),
    credentials: true // Cookie 포함 요청 허용
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
