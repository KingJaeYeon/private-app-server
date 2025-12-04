import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { PrismaClientKnownRequestError } from '@generated/prisma/internal/prismaNamespace';
import { CustomException } from '@/common/exceptions';
import { ErrorResponse } from '@/common/filters/all-exceptions.filter';

@Injectable()
export class ErrorLoggingService {
  private readonly logger = new Logger(ErrorLoggingService.name);
  private readonly isDev = process.env.NODE_ENV !== 'production';

  log(exception: unknown, request: Request, errorResponse: ErrorResponse) {
    const { code, message } = errorResponse;

    // 로깅용 컨텍스트 생성
    const logContext = this.buildLogContext(exception, request, errorResponse);

    // 5xx 에러는 error 레벨, 4xx는 warn 레벨
    if (errorResponse.category === 'GLOBAL') {
      this.logServerError(exception, code, message, logContext);
    } else {
      this.logClientError(exception, code, message, logContext);
    }
  }

  private buildLogContext(exception: unknown, request: Request, errorResponse: ErrorResponse) {
    const baseContext = {
      code: errorResponse.code,
      path: request.url,
      method: request.method,
      statusCode: errorResponse.statusCode,
      userId: (request as any).user?.id,
      ip: this.extractIp(request),
      userAgent: request.headers['user-agent'],
      body: this.isDev ? request.body : undefined,
      query: this.isDev ? request.query : undefined
    };

    // CustomException의 serverMessage 추가 (있는 경우)
    if (exception instanceof CustomException) {
      const response = exception.getResponse() as any;
      if (response.serverMessage) {
        return {
          ...baseContext,
          serverMessage: response.serverMessage // GLOBAL_ERROR_CODES의 serverMessage
        };
      }
    }

    // Prisma 에러의 경우 상세 정보 추가
    if (exception instanceof PrismaClientKnownRequestError) {
      return {
        ...baseContext,
        prismaCode: exception.code,
        prismaMeta: exception.meta,
        prismaClientVersion: exception.clientVersion,
        serverMessage: errorResponse.serverMessage
      };
    }

    return baseContext;
  }

  private logServerError(exception: unknown, code: string, message: string, context: any) {
    // 상세한 에러 로깅
    this.logger.error(
      `[${code}] ${message}\n${JSON.stringify(context, null, 2)}`, // ← 컨텍스트를 메시지에 포함
      exception instanceof Error ? exception.stack : undefined // ← 스택만
    );

    // TODO: 외부 모니터링 서비스 전송
    // this.sendToMonitoring(exception, context);
  }

  private logClientError(exception: unknown, code: string, message: string, context: any) {
    // 경고 수준 로깅
    this.logger.warn(
      `[${code}] ${message}\n${JSON.stringify(context, null, 2)}`, // ← 컨텍스트를 메시지에 포함
      exception instanceof Error ? exception.stack : undefined // ← 스택만
    );
  }

  private extractIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
      return realIp;
    }

    return request.socket.remoteAddress || 'unknown';
  }
}
