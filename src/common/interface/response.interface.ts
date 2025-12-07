import { HttpStatus } from '@nestjs/common';

export interface IApiResponse {
  success: boolean;
  timestamp: string;
}

export interface ISuccessResponse<T> extends IApiResponse {
  data?: T;
}

export interface IErrorDefinition {
  code: string;
  message: string;
  statusCode: HttpStatus;
  serverMessage?: string;
  category: 'GLOBAL' | 'BASE';
}

export interface IErrorResponse extends IApiResponse, IErrorDefinition {
  details?: any;
  path: string;
}
