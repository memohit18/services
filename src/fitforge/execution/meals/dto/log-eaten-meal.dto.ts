import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MEAL_TYPES } from '../../../../../db-schema/postgres/constants/fitforge-values';

export class LogEatenMealDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  foodId!: string;

  @ApiProperty({ enum: MEAL_TYPES })
  @IsIn([...MEAL_TYPES])
  mealType!: string;

  @ApiProperty({
    example: 1.5,
    description: 'Servings eaten. Macros are calculated from this amount.',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(10)
  quantity!: number;

  @ApiPropertyOptional({ example: 'Late-night snack' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
