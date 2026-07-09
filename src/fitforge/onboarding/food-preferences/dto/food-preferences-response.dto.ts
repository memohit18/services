import { ApiProperty } from '@nestjs/swagger';
import { FoodPreferenceResponseDto } from './food-preference-response.dto';

export class FoodPreferencesResponseDto {
  @ApiProperty({ type: [FoodPreferenceResponseDto] })
  favorites: FoodPreferenceResponseDto[];

  @ApiProperty({ type: [FoodPreferenceResponseDto] })
  available: FoodPreferenceResponseDto[];

  @ApiProperty({ type: [FoodPreferenceResponseDto] })
  restricted: FoodPreferenceResponseDto[];
}
