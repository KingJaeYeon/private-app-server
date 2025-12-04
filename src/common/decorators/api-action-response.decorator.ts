import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse, ApiResponseOptions } from '@nestjs/swagger';

type Options = {
  id?: string | number;
  message?: string;
  status?: HttpStatus;
  description?: string;
  headers?: ApiResponseOptions['headers'];
};

/** swagger get을 제외한 요청
 * @example
 * ApiActionResponse({ id, message, status = 201, description })
 */
export function ApiActionResponse(options: Options) {
  const { id, message, status = 201, description, headers } = options ?? {};

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

  const schema: Record<string, any> = {
    properties: {
      success: { type: 'boolean', example: true },
      timestamp: { type: 'string', format: 'date-time' }
    }
  };

  // 🔥 data 하위 속성이 있을 때만 data 스키마 추가
  if (Object.keys(dataProperties).length > 0) {
    schema.properties.data = {
      type: 'object',
      properties: dataProperties
    };
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
