import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { DIET_TYPES, FOOD_CATEGORIES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { transformFoodCategoryInput } from '../constants/food-category.normalizer';

const DIET_TYPE_INPUT = [...DIET_TYPES, 'veg', 'non_veg'] as const;

export class CreateFoodDto {
  @ApiProperty({ example: 'Chicken Breast' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({
    enum: FOOD_CATEGORIES,
    example: 'protein',
    description: 'Aliases accepted: carbs→grain, vegetables→vegetable',
  })
  @IsOptional()
  @Transform(({ value }) => transformFoodCategoryInput(value))
  @IsIn(FOOD_CATEGORIES)
  category?: string;

  @ApiPropertyOptional({ example: 'non_veg' })
  @IsOptional()
  @IsIn(DIET_TYPE_INPUT)
  dietType?: string;

  @ApiPropertyOptional({ example: '100g' })
  @IsOptional()
  @IsString()
  servingSize?: string;

  @ApiProperty({ example: 165 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  calories: number;

  @ApiProperty({ example: 31 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  protein: number;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carbs: number;

  @ApiProperty({ example: 3.6 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fats: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  averageCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
