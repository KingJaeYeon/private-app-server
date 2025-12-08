// get 제외한 요청 response 통일

export class BulkActionResponseDto {
  /** 성공 횟수 @example 3*/
  count?: number;
  /** 메세지 @example "request successfully"*/
  message?: string;
}

export class ActionResponseDto {
  /** id @example 1*/
  id?: number | string;
  /** 메세지 @example "request successfully"*/
  message?: string;
}
