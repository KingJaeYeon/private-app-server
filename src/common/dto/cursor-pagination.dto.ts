// 공통 query dto
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Expose, Transform } from 'class-transformer';

export class CursorPaginationDto {
  /** 배열 마지막 채널ID @example 19*/
  @IsOptional()
  @IsNumber()
  cursor?: number;

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
}

export class CursorPaginationResponseDto {
  /** @example 19*/
  @Expose()
  cursor: number | null;
  /** @example true*/
  @Expose()
  hasNext: boolean;
}
