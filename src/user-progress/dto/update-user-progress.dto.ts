import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { USER_PROGRESS_STATUSES } from '../../../db-schema/mongodb/schemas/user-progress.schema';

export class UpdateUserProgressDto {
  @IsOptional()
  @IsIn(USER_PROGRESS_STATUSES)
  status?: (typeof USER_PROGRESS_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  confidence?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextRevisionDate?: Date;
}
