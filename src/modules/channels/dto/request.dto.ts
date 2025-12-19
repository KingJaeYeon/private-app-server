import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ChannelSortEnum, SubscriberStatusEnum, UploadPeriodEnum, ViewCountEnum } from '@/modules/channels/dto/index';
import { toArray } from '@/common/util/dto.util';

export class SuggestDto {
  /** @example 슈카월드*/
  @IsString()
  q: string;
}

export class ChannelListDto {
  /** @example 슈카월드*/
  @IsString()
  @IsOptional()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsString({ each: true })
  country?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(SubscriberStatusEnum, { each: true })
  subscriber?: SubscriberStatusEnum[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(ViewCountEnum, { each: true })
  dailyViewCount?: ViewCountEnum[];

  @IsEnum(UploadPeriodEnum)
  @IsOptional()
  uploadAt?: UploadPeriodEnum = UploadPeriodEnum.ALL;

  @IsEnum(ChannelSortEnum)
  @IsOptional()
  sort?: ChannelSortEnum = ChannelSortEnum.CREATED_AT;

  @IsString()
  @IsOptional()
  userId?: string;

  // Cursor (마지막 채널 ID)
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  cursor?: number;

  // 페이지 크기
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
