import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { PrismaClientKnownRequestError } from '../generated/prisma/internal/prismaNamespace';

interface ErrorResponse {
  success: false;
  statusCode: number;
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  path: string;
}

@Injectable()
export class ErrorLoggingService {
  private readonly logger = new Logger(ErrorLoggingService.name);
  private readonly isDev = process.env.NODE_ENV !== 'production';

  log(exception: unknown, request: Request, errorResponse: ErrorResponse) {
    const { statusCode, code, message } = errorResponse;

    // 로깅용 컨텍스트 생성
    const logContext = this.buildLogContext(exception, request, errorResponse);

    // 5xx 에러는 error 레벨, 4xx는 warn 레벨
    if (statusCode >= 500) {
      this.logServerError(exception, code, message, logContext);
    } else {
      this.logClientError(code, message, logContext);
    }
  }

  private buildLogContext(exception: unknown, request: Request, errorResponse: ErrorResponse) {
    const baseContext = {
      code: errorResponse.code,
      path: request.url,
      method: request.method,
      statusCode: errorResponse.statusCode,
      userId: (request as any).user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    // Prisma 에러의 경우 상세 정보 추가
    if (exception instanceof PrismaClientKnownRequestError) {
      return {
        ...baseContext,
        prismaCode: exception.code,
        prismaMeta: exception.meta,
        prismaClientVersion: exception.clientVersion,
      };
    }

    return baseContext;
  }

  private logServerError(exception: unknown, code: string, message: string, context: any) {
    // 상세한 에러 로깅
    this.logger.error(
      `[${code}] ${message}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
      JSON.stringify(context, null, 2),
    );

    // TODO: 외부 모니터링 서비스 전송
    // this.sendToMonitoring(exception, context);
  }

  private logClientError(code: string, message: string, context: any) {
    // 경고 수준 로깅
    this.logger.warn(`[${code}] ${message}`, JSON.stringify(context, null, 2));
  }
}
