import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { DIET_TYPES } from '../../../../../db-schema/postgres/constants/fitforge-values';

const DIET_TYPE_INPUT = [...DIET_TYPES, 'veg', 'non_veg'] as const;

export class CreateFoodDto {
  @ApiProperty({ example: 'Chicken Breast' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'protein' })
  @IsOptional()
  @IsString()
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
