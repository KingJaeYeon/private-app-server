import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

type Options<T> = {
  type: Type<T>;
  description?: string;
};

/**
 *
 * @param options swagger get 요청에 대한 responseDto class
 * @example
 * ApiSuccessResponse({ type: UserProfileDto, description: 'description'})
 */
export function ApiSuccessResponse<T>(options: Options<T>) {
  const { description, type } = options ?? {};
  return applyDecorators(
    ApiOkResponse({
      schema: {
        description,
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: getSchemaPath(type) },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    }),
    ApiExtraModels(type)
  );
}
