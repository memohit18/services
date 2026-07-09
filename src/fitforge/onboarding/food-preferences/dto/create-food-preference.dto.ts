import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { FoodPreferenceTypeEnum } from '../constants/food-preferences.enums';

export class CreateFoodPreferenceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  foodId: string;

  @ApiProperty({ enum: FoodPreferenceTypeEnum, example: FoodPreferenceTypeEnum.FAVORITE })
  @IsEnum(FoodPreferenceTypeEnum)
  preferenceType: FoodPreferenceTypeEnum;
}
