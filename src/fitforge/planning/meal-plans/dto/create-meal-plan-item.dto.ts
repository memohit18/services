import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsUUID, Min } from 'class-validator';
import { MEAL_TYPES } from '../../../../../db-schema/postgres/constants/fitforge-values';

export class CreateMealPlanItemDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dayNumber: number;

  @ApiProperty({ enum: MEAL_TYPES })
  @IsIn(MEAL_TYPES)
  mealType: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  foodId: string;

  @ApiProperty({ example: 1.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  quantity: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  calories: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  protein: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  carbs: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  fats: number;
}
