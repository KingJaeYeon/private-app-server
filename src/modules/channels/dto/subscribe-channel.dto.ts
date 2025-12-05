import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubscribeChannelDto {
  /**
   * YouTube 채널 핸들 또는 채널 ID
   * @example "@channelHandle" 또는 "UCxxxxxxxxxxxxx"
   */
  @IsString()
  @IsNotEmpty()
  handle: string;

  /**
   * 태그 ID 배열 (선택)
   * 기존 태그를 구독한 채널에 연결
   * @example [1, 2, 3]
   */
  @IsArray()
  @IsOptional()
  tagIds?: number[];
}

