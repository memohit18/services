import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { DIET_TYPES, FOOD_CATEGORIES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { normalizeFoodCategory } from '../constants/food-category.normalizer';

const DIET_TYPE_INPUT = [...DIET_TYPES, 'veg', 'non_veg'] as const;

export class ListFoodsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: FOOD_CATEGORIES,
    example: 'protein',
    description: 'Aliases accepted: carbs→grain, vegetables→vegetable, fruits→fruit',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.length > 0
      ? normalizeFoodCategory(value)
      : value,
  )
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
