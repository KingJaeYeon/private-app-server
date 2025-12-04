// 예외를 HTTP 응답으로 변환 (로깅은 별도 처리)
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomException } from '../exceptions';
import { ErrorLoggingService } from '@/core/error-logging.service';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@generated/prisma/internal/prismaNamespace';
import { GLOBAL_ERROR_CODES } from '@/common/exceptions/error-code';

export interface ErrorResponse {
  success: false;
  statusCode: number;
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  path: string;
  serverMessage?: string;
  category: 'GLOBAL' | 'BASE';
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
    const { serverMessage, ...safeResponse } = errorResponse;
    response.status(safeResponse.statusCode).json(safeResponse);
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    const base = this.createBaseError(request);

    if (exception instanceof CustomException) {
      const res: any = exception.getResponse();
      const status = exception.getStatus();
      return {
        ...base,
        statusCode: status,
        code: res.code,
        message: res.message,
        details: res.details,
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
      return {
        ...base,
        statusCode: status,
        code: `HTTP-${status}`,
        message: res.message || exception.message,
        category: 'GLOBAL',
        serverMessage: `${JSON.stringify({
          details: typeof res === 'object' ? res.details : undefined,
          message: typeof res === 'string' ? res : res.message || exception.message
        })}`
      };
    }

    // 3. Prisma 에러 → 클라이언트엔 일반 메시지만 전달
    if (exception instanceof PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, base);
    }

    // 4. Prisma Validation 에러
    if (exception instanceof PrismaClientValidationError) {
      const e = GLOBAL_ERROR_CODES.PRISMA_VALIDATION_ERROR;
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
    base: Pick<ErrorResponse, 'success' | 'timestamp' | 'path'>
  ): ErrorResponse {
    switch (exception.code) {
      // Unique constraint violation
      case 'P2002': {
        const target = exception.meta?.target as string[] | undefined;
        const field = target?.[0];

        // 필드별 구체적 에러 (이건 GLOBAL이 아니라 BASE_ERROR_CODES에 있음)
        // 여기서는 일반적인 중복 에러로 처리
        return {
          ...base,
          statusCode: HttpStatus.CONFLICT,
          code: 'DB-P2002',
          message: `중복된 데이터입니다`,
          serverMessage: `Duplicate field: ${field}`,
          category: 'GLOBAL'
        };
      }

      // Record not found
      case 'P2025': {
        return {
          ...base,
          statusCode: HttpStatus.NOT_FOUND,
          code: 'DB-P2025',
          message: '요청한 데이터를 찾을 수 없습니다',
          category: 'GLOBAL'
        };
      }

      // Foreign key constraint
      case 'P2003': {
        return {
          ...base,
          statusCode: HttpStatus.BAD_REQUEST,
          code: 'DB-P2003',
          message: '잘못된 참조입니다',
          category: 'GLOBAL'
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
          category: 'GLOBAL'
        };
      }

      // 기타 Prisma 에러
      default: {
        return {
          ...base,
          statusCode: GLOBAL_ERROR_CODES.DATABASE_ERROR.statusCode,
          code: GLOBAL_ERROR_CODES.DATABASE_ERROR.code,
          message: GLOBAL_ERROR_CODES.DATABASE_ERROR.message,
          category: 'GLOBAL'
        };
      }
    }
  }

  private createBaseError(request: Request): Pick<ErrorResponse, 'success' | 'timestamp' | 'path'> {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      path: request.url
    };
  }
}
