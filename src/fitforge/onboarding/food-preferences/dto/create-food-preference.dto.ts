import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { FOOD_PREFERENCE_TYPES } from '../../../../../db-schema/postgres/constants/fitforge-values';

export class CreateFoodPreferenceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  foodId: string;

  @ApiProperty({ enum: FOOD_PREFERENCE_TYPES, example: 'favorite' })
  @IsIn(FOOD_PREFERENCE_TYPES)
  preferenceType: string;
}
