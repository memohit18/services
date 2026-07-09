import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { DIET_TYPES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { FOOD_CATEGORY_VALUES } from '../../food-preferences/constants/food-preferences.enums';

const DIET_TYPE_INPUT = [...DIET_TYPES, 'veg', 'non_veg'] as const;

export class ListFoodsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FOOD_CATEGORY_VALUES, example: 'protein' })
  @IsOptional()
  @IsIn(FOOD_CATEGORY_VALUES)
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
