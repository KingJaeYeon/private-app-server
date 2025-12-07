import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

/** 기간 기반 조회 */
export class DateRangeDto {
  /** @example "2024-01-01" */
  @Type(() => Date)
  @IsOptional()
  @IsDate()
  from?: Date;

  /** @example "2024-12-31" */
  @Type(() => Date)
  @IsOptional()
  @IsDate()
  to?: Date;
}
