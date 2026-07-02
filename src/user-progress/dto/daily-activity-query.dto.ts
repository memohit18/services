import { IsOptional, Matches } from 'class-validator';

export class DailyActivityQueryDto {
  /** Calendar month in YYYY-MM format. Defaults to the current UTC month. */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format',
  })
  month?: string;
}
