import { IsIn, IsOptional } from 'class-validator';
import { USER_PROGRESS_STATUSES } from '../../../db-schema/mongodb/schemas/user-progress.schema';

export class ListUserProgressQueryDto {
  @IsOptional()
  @IsIn(USER_PROGRESS_STATUSES)
  status?: (typeof USER_PROGRESS_STATUSES)[number];
}
