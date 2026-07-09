import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { DIET_TYPES, FOOD_CATEGORIES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

const DIET_TYPE_INPUT = [...DIET_TYPES, 'veg', 'non_veg'] as const;

export class ListFoodsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FOOD_CATEGORIES, example: 'protein' })
  @IsOptional()
  @IsIn(FOOD_CATEGORIES)
  category?: string;

  @ApiPropertyOptional({ example: 'vegetarian' })
  @IsOptional()
  @IsIn(DIET_TYPE_INPUT)
  dietType?: string;

  @ApiPropertyOptional({ example: 'paneer' })
  @IsOptional()
  @IsString()
  search?: string;
}
