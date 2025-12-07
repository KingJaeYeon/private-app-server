import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import {
  ApiResponseOptions,
  getSchemaPath,
  ApiResponse,
  ApiOperation,
  ApiOperationOptions,
  ApiExtraModels
} from '@nestjs/swagger';

type SingleActionBody = {
  id?: string | number;
  message?: string;
};

type BulkActionBody = {
  count: number;
  message?: string;
};

type Body = SingleActionBody | BulkActionBody;

type Options = {
  body: Body;
  status?: HttpStatus;
  description?: string;
  headers?: ApiResponseOptions['headers'];
  operations: ApiOperationOptions;
};

export const headers: ApiResponseOptions['headers'] = {
  'Set-Cookie-Access-Token': {
    description: '인증에 사용되는 Access Token (HttpOnly, 짧은 만료 시간)',
    schema: {
      type: 'string',
      example: 'access_token=jwt.access.token; HttpOnly; Secure; Path=/'
    }
  },
  'Set-Cookie-Refresh-Token': {
    description: '토큰 갱신에 사용되는 Refresh Token (HttpOnly)',
    schema: {
      type: 'string',
      example: 'refresh_token=jwt.refresh.token; HttpOnly; Secure; Path=/auth'
    }
  }
};

/** swagger get을 제외한 요청
 * @example
 * ApiActionResponse({ body: { id: 1, message: 'deleted' }, status: 201 })
 * ApiActionResponse({ body: { count: 5 }, status: 201 })
 */
export function ApiActionResponse(options: Options) {
  const { body, status = 201, description, headers, operations } = options ?? {};

  const schema: Record<string, any> = {
    properties: {
      success: { type: 'boolean', example: true },
      timestamp: { type: 'string', format: 'date-time' }
    }
  };

  // responseType 없음 → 기존 처리 유지
  const dataProperties: Record<string, any> = {};

  if ('id' in body) {
    dataProperties.id = {
      type: typeof body.id === 'number' ? 'number' : 'string',
      example: body.id
    };
  }

  if ('count' in body) {
    dataProperties.count = {
      type: 'number',
      example: body.count
    };
  }

  if (body.message !== undefined) {
    dataProperties.message = {
      type: 'string',
      example: body.message
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
