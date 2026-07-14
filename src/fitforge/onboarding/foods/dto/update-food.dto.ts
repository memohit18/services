import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { FOOD_CATEGORIES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { transformFoodCategoryUpdate } from '../constants/food-category.normalizer';
import { CreateFoodDto } from './create-food.dto';

export class UpdateFoodDto extends PartialType(OmitType(CreateFoodDto, ['category', 'imageUrl'])) {
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

  @ApiPropertyOptional({
    nullable: true,
    example:
      'https://cdn.example.com/uploads/userId/food/uuid/medium.webp',
    description:
      'Public image URL from POST /images (type=food). Pass null to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;
}
