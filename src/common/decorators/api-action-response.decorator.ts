import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiResponseOptions, getSchemaPath, ApiResponse } from '@nestjs/swagger';

type ResponseType<T> = { type: Type<T>; isArray?: false } | { type: Type<T>; isArray: true };

type Options<T> = {
  id?: string | number;
  responseType?: ResponseType<T>; // 👈 객체로 묶음
  message?: string;
  status?: HttpStatus;
  description?: string;
  headers?: ApiResponseOptions['headers'];
};

/** swagger get을 제외한 요청
 * @example
 * ApiActionResponse({ responseType: { type: UserDto }, status: 201 })
 * ApiActionResponse({ responseType: { type: UserDto, isArray: true }, status: 200 })
 * ApiActionResponse({ id: 1, message: 'deleted' })
 */
export function ApiActionResponse<T>(options: Options<T>) {
  const { id, message, status = 201, description, headers, responseType } = options ?? {};

  const schema: Record<string, any> = {
    properties: {
      success: { type: 'boolean', example: true },
      timestamp: { type: 'string', format: 'date-time' }
    }
  };

  // responseType이 있으면 DTO 스키마 사용
  if (responseType) {
    const { type, isArray = false } = responseType;

    if (isArray) {
      schema.properties.data = {
        type: 'array',
        items: { $ref: getSchemaPath(type) }
      };
    } else {
      schema.properties.data = {
        $ref: getSchemaPath(type)
      };
    }
  }
  // responseType이 없고 id나 message가 있으면 기존 방식
  else {
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
  }

  return applyDecorators(
    ApiResponse({
      headers,
      status,
      description,
      schema
    })
  );
}
