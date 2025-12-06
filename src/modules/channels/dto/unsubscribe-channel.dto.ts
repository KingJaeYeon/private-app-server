import { IsArray, ArrayMinSize, IsInt, ArrayMaxSize } from 'class-validator';

export class UnsubscribeChannelDto {
  /**
   * 삭제 Ids (max:10)
   * @example [1,2,3]
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  subscriptionIds: number[];
}

export class BulkUnsubscribeResponseDto {
  /**
   *  삭제된 개수
   *  @example 2
   */
  deleted: number;

  /**
   *  실제 삭제된 ID 리스트
   *  @example [1,2]
   */
  deletedIds: number[];

  /**
   * 삭제 실패한 ID리스트
   * @example [3]
   */
  failedIds: number[];
}
