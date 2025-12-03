import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/**
 *
 * @param type swagger get 요청에 대한 responseDto class
 * @example
 * ApiSuccessResponse(UserProfileDto)
 */
export function ApiSuccessResponse<T>(type: Type<T>) {
  return applyDecorators(
    ApiOkResponse({
      schema: {
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
