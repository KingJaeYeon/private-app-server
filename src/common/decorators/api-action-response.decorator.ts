import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

/** swagger get을 제외한 요청
 * @example
 * ApiActionResponse()
 */
export function ApiActionResponse(options: { id?: string | number; message?: string }) {
  const { id, message } = options ?? {};

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

  return applyDecorators(
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: dataProperties
          },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    })
  );
}
