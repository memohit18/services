import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { DIET_TYPES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

const DIET_TYPE_INPUT = [...DIET_TYPES, 'veg', 'non_veg'] as const;

export class ListFoodsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'protein' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'veg' })
  @IsOptional()
  @IsIn(DIET_TYPE_INPUT)
  dietType?: string;

  @ApiPropertyOptional({ example: 'egg' })
  @IsOptional()
  @IsString()
  search?: string;
}
