// get 제외한 요청 response 통일

import { Expose } from 'class-transformer';

export class BulkActionResponseDto {
  /** 성공 횟수 @example 3*/
  @Expose()
  count?: number;
  /** 메세지 @example "request successfully"*/
  @Expose()
  message?: string;
}

export class ActionResponseDto {
  /** id @example 1*/
  @Expose()
  id?: number | string;
  @Expose()
  /** 메세지 @example "request successfully"*/
  message?: string;
}
