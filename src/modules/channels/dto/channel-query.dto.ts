import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ChannelOrderByEnum, ChannelOrderEnum } from '@/modules/channels/dto';
import { CursorPaginationDto } from '@/common/dto/cursor-pagination.dto';

export class ChannelQueryDto extends CursorPaginationDto {
  /** 정렬키 값 @example 'createdAt'*/
  @IsOptional()
  @IsEnum(ChannelOrderByEnum)
  orderBy: ChannelOrderByEnum = ChannelOrderByEnum.createdAt;

  /** 정렬 @example 'desc'*/
  @IsOptional()
  @IsEnum(ChannelOrderEnum)
  order: ChannelOrderEnum = ChannelOrderEnum.desc;
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
