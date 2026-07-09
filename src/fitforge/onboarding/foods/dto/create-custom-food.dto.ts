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

export class CreateCustomFoodDto {
  @ApiProperty({ example: "Mom's Paneer Curry" })
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

  @ApiPropertyOptional({ example: 'veg' })
  @IsOptional()
  @IsIn(DIET_TYPE_INPUT)
  dietType?: string;

  @ApiPropertyOptional({ example: '1 bowl' })
  @IsOptional()
  @IsString()
  servingSize?: string;

  @ApiProperty({ example: 320 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  calories: number;

  @ApiProperty({ example: 18 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  protein: number;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carbs: number;

  @ApiProperty({ example: 22 })
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
