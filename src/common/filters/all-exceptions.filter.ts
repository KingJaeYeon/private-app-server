// 예외를 HTTP 응답으로 변환 (로깅은 별도 처리)
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomException } from '../exceptions';
import { ERROR_CODES } from '../exceptions';
import { ErrorLoggingService } from '@/core/error-logging.service';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@generated/prisma/internal/prismaNamespace';

interface ErrorResponse {
  success: false;
  statusCode: number;
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly errorLoggingService: ErrorLoggingService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    // 로깅 서비스에 위임
    this.errorLoggingService.log(exception, request, errorResponse);

    // 클라이언트 응답 (안전한 정보만)
    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;

    // 1. CustomException (우리가 정의한 비즈니스 에러)
    if (exception instanceof CustomException) {
      const status = exception.getStatus();
      const exceptionResponse: any = exception.getResponse();

      return {
        success: false,
        statusCode: status,
        code: exceptionResponse.code,
        message: exceptionResponse.message,
        details: exceptionResponse.details,
        timestamp,
        path
      };
    }

    // 2. NestJS HttpException (Validation 등)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse: any = exception.getResponse();

      return {
        success: false,
        statusCode: status,
        code: this.getErrorCodeFromStatus(status),
        message:
          typeof exceptionResponse === 'string' ? exceptionResponse : exceptionResponse.message || exception.message,
        details: typeof exceptionResponse === 'object' ? exceptionResponse.details : undefined,
        timestamp,
        path
      };
    }

    // 3. Prisma 에러 → 클라이언트엔 일반 메시지만 전달
    if (exception instanceof PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, timestamp, path);
    }

    // 4. Prisma Validation 에러
    if (exception instanceof PrismaClientValidationError) {
      return {
        success: false,
        statusCode: ERROR_CODES.DATABASE_ERROR.statusCode,
        code: ERROR_CODES.DATABASE_ERROR.code,
        message: ERROR_CODES.DATABASE_ERROR.message,
        timestamp,
        path
      };
    }

    // 5. 알 수 없는 에러 → 클라이언트엔 일반 메시지만
    return {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
      timestamp,
      path
    };
  }

  private handlePrismaError(exception: PrismaClientKnownRequestError, timestamp: string, path: string): ErrorResponse {
    // 클라이언트에 보낼 안전한 메시지
    const safeError = {
      success: false as const,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.DATABASE_ERROR.code,
      message: ERROR_CODES.DATABASE_ERROR.message,
      timestamp,
      path
    };

    // Unique constraint는 비즈니스 로직상 의미있는 에러이므로 구체적으로 알려줌
    if (exception.code === 'P2002') {
      const target = exception.meta?.target as string[] | undefined;
      const field = target?.[0];

      // 필드별로 적절한 에러 반환
      if (field === 'email') {
        return {
          ...safeError,
          statusCode: HttpStatus.CONFLICT,
          code: ERROR_CODES.EMAIL_ALREADY_EXISTS.code,
          message: ERROR_CODES.EMAIL_ALREADY_EXISTS.message
        };
      }

      if (field === 'username') {
        return {
          ...safeError,
          statusCode: HttpStatus.CONFLICT,
          code: ERROR_CODES.USERNAME_ALREADY_EXISTS.code,
          message: ERROR_CODES.USERNAME_ALREADY_EXISTS.message
        };
      }

      // 기타 중복
      return {
        ...safeError,
        statusCode: HttpStatus.CONFLICT,
        code: ERROR_CODES.CONFLICT.code,
        message: ERROR_CODES.CONFLICT.message
      };
    }

    // Record not found
    if (exception.code === 'P2025') {
      return {
        ...safeError,
        statusCode: HttpStatus.NOT_FOUND,
        code: ERROR_CODES.NOT_FOUND.code,
        message: ERROR_CODES.NOT_FOUND.message
      };
    }

    // 나머지 Prisma 에러는 모두 일반 메시지로
    return safeError;
  }

  private getErrorCodeFromStatus(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'HTTP-400',
      401: 'HTTP-401',
      403: 'HTTP-403',
      404: 'HTTP-404',
      409: 'HTTP-409',
      422: 'HTTP-422',
      429: 'HTTP-429',
      500: 'HTTP-500',
      503: 'HTTP-503'
    };
    return codeMap[status] || 'HTTP-UNKNOWN';
  }
}
