import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { USER_PROGRESS_STATUSES } from '../../../db-schema/mongodb/schemas/user-progress.schema';

export class ListUserProgressQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(USER_PROGRESS_STATUSES)
  status?: (typeof USER_PROGRESS_STATUSES)[number];
}
