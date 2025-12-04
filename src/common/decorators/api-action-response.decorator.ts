import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

type Options = {
  id?: string | number;
  message?: string;
  status?: HttpStatus;
  description?: string;
};

/** swagger get을 제외한 요청
 * @example
 * ApiActionResponse()
 */
export function ApiActionResponse(options: Options) {
  const { id, message, status = 201, description } = options ?? {};

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
    ApiResponse({
      status,
      description,
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
