import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, ValidateIf } from 'class-validator';
import { FOOD_CATEGORIES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { transformFoodCategoryUpdate } from '../constants/food-category.normalizer';
import { CreateFoodDto } from './create-food.dto';

export class UpdateFoodDto extends PartialType(OmitType(CreateFoodDto, ['category'])) {
  @ApiPropertyOptional({
    enum: FOOD_CATEGORIES,
    nullable: true,
    example: 'grain',
    description: 'Set null to remove category. Aliases accepted: carbs→grain',
  })
  @IsOptional()
  @Transform(({ value }) => transformFoodCategoryUpdate(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsIn(FOOD_CATEGORIES)
  category?: string | null;
}
