import { IsArray, IsOptional } from 'class-validator';

export class UpdateSubscriptionDto {
  /** 태그 ID 배열 구독한 채널에 연결할 태그들 @example [1, 2, 3]*/
  @IsArray()
  @IsOptional()
  tagIds?: number[];
}

