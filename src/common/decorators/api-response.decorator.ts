import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

type Options<T> = {
  type: Type<T>;
  isArray?: boolean;
  description?: string;
};

/**
 * @param options swagger get 요청에 대한 responseDto class
 * @example
 * ApiSuccessResponse({ type: UserProfileDto, description: 'description' })
 * ApiSuccessResponse({ type: UserDto, isArray: true, description: '유저 목록' })
 */
export function ApiSuccessResponse<T>(options: Options<T>) {
  const { description, type, isArray = false } = options ?? {};

  const dataSchema = isArray
    ? {
        type: 'array',
        items: { $ref: getSchemaPath(type) }
      }
    : { $ref: getSchemaPath(type) };

  return applyDecorators(
    ApiOkResponse({
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
