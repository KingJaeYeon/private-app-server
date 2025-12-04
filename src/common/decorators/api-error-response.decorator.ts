import { applyDecorators } from '@nestjs/common';
import { ApiResponse  } from '@nestjs/swagger';
import { ERROR_CODES, ErrorCode } from '@/common/exceptions/error-code';

/**
 * Swagger에 여러 에러 응답을 자동으로 문서화
 * @param errorCodes - ERROR_CODES의 키 배열
 * @example
 * @ApiErrorResponses(['USER_NOT_FOUND', 'UNAUTHORIZED', 'FORBIDDEN'])
 */
export function ApiErrorResponses(errorCodes: ErrorCode[]) {
  const decorators = errorCodes.map((errorCode) => {
    const errorDef = ERROR_CODES[errorCode];

    return ApiResponse({
      status: errorDef.statusCode,
      description: errorDef.message,
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          statusCode: {
            type: 'number',
            example: errorDef.statusCode,
          },
          code: {
            type: 'string',
            example: errorDef.code,
          },
          message: {
            type: 'string',
            example: errorDef.message,
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-01T00:00:00.000Z',
          },
          path: {
            type: 'string',
            example: '/api/users/123',
          },
        },
      },
    });
  });
  return applyDecorators(...decorators);
}