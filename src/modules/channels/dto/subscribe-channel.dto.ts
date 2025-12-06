import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class SubscribeChannelDto {
  /** YouTube 채널 핸들 @example "[@channelHandle]" */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  handles: string[];
}
