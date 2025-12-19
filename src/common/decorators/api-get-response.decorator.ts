import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiOperationOptions,
  ApiResponseOptions,
  getSchemaPath
} from '@nestjs/swagger';

type Options<T> = {
  type?: Type<T>;
  isArray?: boolean;
  description?: string;
  operations: ApiOperationOptions;
  headers?: ApiResponseOptions['headers'];
};

/**
 * @param options swagger get 요청에 대한 responseDto class
 * @example
 * ApiGetResponse({ type: UserProfileDto, description: 'description' })
 * ApiGetResponse({ type: UserDto, isArray: true, description: '유저 목록' })
 */
export function ApiGetResponse<T>(options: Options<T>) {
  const { description, type, isArray = false, operations, headers } = options ?? {};

  if (!type) {
    return applyDecorators(
      ApiOperation(operations),
      ApiOkResponse({
        headers,
        schema: {
          description,
          properties: {
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      })
    );
  }

  const dataSchema = isArray
    ? {
        type: 'array',
        items: { $ref: getSchemaPath(type) }
      }
    : { $ref: getSchemaPath(type) };

  return applyDecorators(
    ApiOperation(operations),
    ApiOkResponse({
      headers,
      schema: {
        description,
        properties: {
          success: { type: 'boolean', example: true },
          data: dataSchema,
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    }),
    ApiExtraModels(type)
  );
}
