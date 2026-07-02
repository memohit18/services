import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { UPLOAD_CATEGORIES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class ListUploadsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UPLOAD_CATEGORIES })
  @IsOptional()
  @IsIn(UPLOAD_CATEGORIES)
  category?: string;
}
