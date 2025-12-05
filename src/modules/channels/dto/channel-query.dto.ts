import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export type ChannelOrder = 'asc' | 'desc';
export type ChannelOrderBy = 'viewCount' | 'subscriberCount' | 'createdAt'

export enum ChannelOrderByEnum {
  viewCount = 'viewCount',
  subscriberCount = 'subscriberCount',
  createdAt = 'createdAt',
}

export enum ChannelOrderEnum {
  asc = 'asc',
  desc = 'desc',
}

export class ChannelQueryDto {
  /**
   * 요청리스트 수 (max:50)
   * @example 20
   */
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num)) return 20;
    return Math.min(num, 50);
  })
  @IsInt()
  @Min(1)
  @Max(50)
  take: number = 20;

  /**
   * 정렬키 값
   * @example 'createdAt'
   */
  @IsOptional()
  @IsEnum(ChannelOrderByEnum)
  orderBy: ChannelOrderByEnum = ChannelOrderByEnum.createdAt;

  /**
   * 정렬
   * @example 'desc'
   */
  @IsOptional()
  @IsEnum(ChannelOrderEnum)
  order: ChannelOrderEnum = ChannelOrderEnum.desc;

  /**
   * 배열 마지막 채널ID
   * @example 19
   */
  @IsOptional()
  cursor?: number;
}
