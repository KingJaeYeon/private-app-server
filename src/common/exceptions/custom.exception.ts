import { HttpException } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from './error-code';

export class CustomException extends HttpException {
  public readonly code: string;

  constructor(
    errorCode: ErrorCode,
    public readonly details?: Record<string, any>,
  ) {
    const errorDef = ERROR_CODES[errorCode];

    super(
      {
        success: false,
        code: errorDef.code,
        message: errorDef.message,
        details,
      },
      errorDef.statusCode,
    );

    this.code = errorDef.code;
  }

  // 동적 메시지 필요한 경우
  static withMessage(errorCode: ErrorCode, customMessage: string, details?: Record<string, any>): CustomException {
    const exception = new CustomException(errorCode, details);
    const response = exception.getResponse() as any;
    response.message = customMessage;
    return exception;
  }
}
