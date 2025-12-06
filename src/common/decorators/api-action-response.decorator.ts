import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import {
  ApiResponseOptions,
  getSchemaPath,
  ApiResponse,
  ApiOperation,
  ApiOperationOptions,
  ApiExtraModels
} from '@nestjs/swagger';

type ResponseType<T> = { type: Type<T>; isArray?: false } | { type: Type<T>; isArray: true };

type Options<T> = {
  id?: string | number;
  responseType?: ResponseType<T>; // 👈 객체로 묶음
  message?: string;
  status?: HttpStatus;
  description?: string;
  headers?: ApiResponseOptions['headers'];
  operations: ApiOperationOptions;
};

/** swagger get을 제외한 요청
 * @example
 * ApiActionResponse({ responseType: { type: UserDto }, status: 201 })
 * ApiActionResponse({ responseType: { type: UserDto, isArray: true }, status: 200 })
 * ApiActionResponse({ id: 1, message: 'deleted' })
 */
export function ApiActionResponse<T>(options: Options<T>) {
  const { id, message, status = 201, description, headers, responseType, operations } = options ?? {};

  const schema: Record<string, any> = {
    properties: {
      success: { type: 'boolean', example: true },
      timestamp: { type: 'string', format: 'date-time' }
    }
  };

  if (responseType) {
    const { type, isArray = false } = responseType;

    // Swagger에 DTO 등록 👇 반드시 필요
    const decorators = [
      ApiOperation(operations),
      ApiExtraModels(type), // 📌 Swagger에 컴포넌트 등록!
      ApiResponse({
        headers,
        status,
        description,
        schema: {
          ...schema,
          properties: {
            ...schema.properties,
            data: isArray
              ? {
                  type: 'array',
                  items: { $ref: getSchemaPath(type) }
                }
              : {
                  $ref: getSchemaPath(type)
                }
          }
        }
      })
    ];

    return applyDecorators(...decorators);
  }

  // responseType 없음 → 기존 처리 유지
  const dataProperties: Record<string, any> = {};

  if (id !== undefined) {
    dataProperties.id = {
      type: typeof id === 'number' ? 'number' : 'string',
      example: id
    };
  }

  if (message !== undefined) {
    dataProperties.message = {
      type: 'string',
      example: message
    };
  }

  if (Object.keys(dataProperties).length > 0) {
    schema.properties.data = {
      type: 'object',
      properties: dataProperties
    };
  }

  return applyDecorators(
    ApiOperation(operations),
    ApiResponse({
      headers,
      status,
      description,
      schema
    })
  );
}
