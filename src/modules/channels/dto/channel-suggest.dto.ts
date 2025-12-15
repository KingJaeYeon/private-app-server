import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ChannelSuggestDto {
  /** @example 슈카월드*/
  @IsString()
  q: string;
}

export class ChannelSuggestResponseDto {
  @IsString()
  channelId: string;
  @IsNumber()
  subscriberCount: number;
  @IsString()
  @IsOptional()
  thumbnailUrl: string | null;
  @IsString()
  name: string;
}
