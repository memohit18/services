import { ApiProperty } from '@nestjs/swagger';

export class FoodPreferenceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  foodId: string;

  @ApiProperty()
  preferenceType: string;

  @ApiProperty()
  createdAt: Date;
}
