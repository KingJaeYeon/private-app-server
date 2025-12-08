import { Transform } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

/** 기본 오프셋 기반 페이지네이션 DTO */
export class PaginationDto {
  /** @example 20 */
  @Transform(({ value }) => {
    const n = Number(value);
    return isNaN(n) ? 20 : Math.min(Math.max(n, 1), 50);
  })
  @IsInt()
  @Min(1)
  @Max(50)
  take: number = 20;

  /** @example 1 */
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page: number = 1;
}
