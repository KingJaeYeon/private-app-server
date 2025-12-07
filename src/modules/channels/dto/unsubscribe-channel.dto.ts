import { IsArray, ArrayMinSize, IsInt, ArrayMaxSize } from 'class-validator';

export class UnsubscribeChannelDto {
  /** 삭제 Ids (max:10) @example [1,2,3]*/
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  subscriptionIds: number[];
}
