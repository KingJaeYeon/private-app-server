import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ChannelOrderByEnum, ChannelOrderEnum } from '@/modules/channels/dto';

export class ChannelQueryDto {
  /** 요청리스트 수 (max:50) @example 20*/
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num)) return 20;
    return Math.min(num, 50);
  })
  @IsInt()
  @Min(1)
  @Max(50)
  take: number = 20;

  /** 정렬키 값 @example 'createdAt'*/
  @IsOptional()
  @IsEnum(ChannelOrderByEnum)
  orderBy: ChannelOrderByEnum = ChannelOrderByEnum.createdAt;

  /** 정렬 @example 'desc'*/
  @IsOptional()
  @IsEnum(ChannelOrderEnum)
  order: ChannelOrderEnum = ChannelOrderEnum.desc;

  /** 배열 마지막 채널ID @example 19*/
  @IsOptional()
  cursor?: number;
}

export class SubscriptionsQueryDto extends ChannelQueryDto {
  /** 태그Ids (max:5) @example [1,2,3]*/
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  tagIds?: number[];

  /** 태그 필터 모드 (AND / OR) @example and */
  @IsOptional()
  @IsEnum(['and', 'or'])
  mode: 'and' | 'or' = 'and';
}

export class ChannelDetailsQueryDto {
  @IsNumber()
  channelId: number;
}
