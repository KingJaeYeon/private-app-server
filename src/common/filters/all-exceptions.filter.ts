// 예외를 HTTP 응답으로 변환 (로깅은 별도 처리)
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomException } from '../exceptions';
import { ErrorLoggingService } from '@/core/error-logging.service';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@generated/prisma/internal/prismaNamespace';
import { GLOBAL_ERROR_CODES } from '@/common/exceptions/error-code';
import { IErrorResponse } from '@/common/interface/response.interface';

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
    const { serverMessage, category, ...safeResponse } = errorResponse;
    response.status(safeResponse.statusCode).json(safeResponse);
  }

  private buildErrorResponse(exception: unknown, request: Request): IErrorResponse {
    const base = this.createBaseError(request);

    if (exception instanceof CustomException) {
      const res: any = exception.getResponse();
      const status = exception.getStatus();
      return {
        ...base,
        statusCode: status,
        code: res.code,
        message: res.message,
        details: exception.details, // CustomException의 details 속성 직접 사용
        serverMessage: res.serverMessage,
        category: res.category
      };
    }

    // 2. NestJS HttpException (Validation 등)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res: any = exception.getResponse();

      // class-validator 대응: message 배열 형태
      if (status === 400 && Array.isArray(res.message)) {
        return {
          ...base,
          statusCode: status,
          code: GLOBAL_ERROR_CODES.VALIDATION_ERROR.code,
          message: GLOBAL_ERROR_CODES.VALIDATION_ERROR.message,
          details: { errors: res.message }, // 검증 실패 목록
          serverMessage: res.serverMessage,
          category: 'GLOBAL'
        };
      }

      // 예상하지 못한 HttpException
      const unexpectedError = GLOBAL_ERROR_CODES.UNEXPECTED_HTTP_EXCEPTION;
      return {
        ...base,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR, // 👈 500으로 강등
        code: unexpectedError.code,
        message: unexpectedError.message,
        category: 'GLOBAL',
        serverMessage: JSON.stringify({
          originalStatus: status, // 추적용
          originalCode: res.error || `HTTP-${status}`,
          originalMessage: res.message || exception.message,
          details: typeof res === 'object' ? res.details : undefined
        })
      };
    }

    // 3. Prisma 에러 → 클라이언트엔 일반 메시지만 전달
    if (exception instanceof PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, base);
    }

    // 4. Prisma Validation 에러
    if (exception instanceof PrismaClientValidationError) {
      const e = GLOBAL_ERROR_CODES.PRISMA_VALIDATION;
      return {
        ...base,
        statusCode: e.statusCode,
        code: e.code,
        message: e.message,
        category: 'GLOBAL',
        serverMessage: JSON.stringify({
          message: e.serverMessage,
          serverMessage: exception.message
        })
      };
    }

    // 5. 알 수 없는 에러 → 클라이언트엔 일반 메시지만
    const e = GLOBAL_ERROR_CODES.INTERNAL_SERVER_ERROR;
    return {
      ...base,
      statusCode: e.statusCode,
      code: e.code,
      message: e.message,
      serverMessage: e.serverMessage,
      category: 'GLOBAL'
    };
  }

  private handlePrismaError(
    exception: PrismaClientKnownRequestError,
    base: Pick<IErrorResponse, 'success' | 'timestamp' | 'path'>
  ): IErrorResponse {
    switch (exception.code) {
      // Unique constraint violation
      case 'P2002': {
        const field = (exception.meta?.target as string[])?.[0] ?? 'unknown';

        // 필드별 구체적 에러 (이건 GLOBAL이 아니라 BASE_ERROR_CODES에 있음)
        // 여기서는 일반적인 중복 에러로 처리
        const e = GLOBAL_ERROR_CODES.PRISMA_DUPLICATE;
        return {
          ...base,
          statusCode: e.statusCode,
          code: e.code,
          message: e.message,
          category: 'GLOBAL',
          serverMessage: `P2002 Unique constraint failed on: ${field}`
        };
      }

      // Record not found
      case 'P2025': {
        const e = GLOBAL_ERROR_CODES.PRISMA_NOT_FOUND;
        return {
          ...base,
          statusCode: e.statusCode,
          code: e.code,
          message: e.message,
          category: 'GLOBAL',
          serverMessage: e.serverMessage
        };
      }

      // Foreign key constraint
      case 'P2003': {
        const e = GLOBAL_ERROR_CODES.PRISMA_INVALID_REFERENCE;
        const field = (exception.meta?.target as string[])?.[0] ?? 'unknown';

        return {
          ...base,
          statusCode: e.statusCode,
          code: e.code,
          message: e.message,
          category: 'GLOBAL',
          serverMessage: `P2003 Foreign key constraint failed (${field})`
        };
      }

      // Connection error
      case 'P1001':
      case 'P1002':
      case 'P1008': {
        return {
          ...base,
          statusCode: GLOBAL_ERROR_CODES.DATABASE_CONNECTION_FAILED.statusCode,
          code: GLOBAL_ERROR_CODES.DATABASE_CONNECTION_FAILED.code,
          message: GLOBAL_ERROR_CODES.DATABASE_CONNECTION_FAILED.message,
          category: 'GLOBAL',
          serverMessage: `Prisma connection issue: ${exception.code}`
        };
      }

      // 기타 Prisma 에러
      default: {
        return {
          ...base,
          statusCode: GLOBAL_ERROR_CODES.DATABASE_ERROR.statusCode,
          code: GLOBAL_ERROR_CODES.DATABASE_ERROR.code,
          message: GLOBAL_ERROR_CODES.DATABASE_ERROR.message,
          category: 'GLOBAL',
          serverMessage: `Database error occurred: ${exception.code}`
        };
      }
    }
  }

  private createBaseError(request: Request): Pick<IErrorResponse, 'success' | 'timestamp' | 'path'> {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      path: request.url
    };
  }
}
