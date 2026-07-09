import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NutritionPreferencesResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  budgetCategory?: string | null;

  @ApiPropertyOptional()
  preferredCuisine?: string | null;

  @ApiPropertyOptional()
  mealsPerDay?: number | null;

  @ApiPropertyOptional()
  cookingTimeMinutes?: number | null;

  @ApiPropertyOptional()
  preferredMealTiming?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
