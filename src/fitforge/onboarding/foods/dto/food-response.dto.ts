import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FoodResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  category?: string | null;

  @ApiPropertyOptional()
  dietType?: string | null;

  @ApiPropertyOptional()
  servingSize?: string | null;

  @ApiPropertyOptional({ example: 240 })
  servingAmount?: number | null;

  @ApiPropertyOptional({ example: 'ml' })
  servingUnit?: string | null;

  @ApiProperty()
  calories: number;

  @ApiProperty()
  protein: number;

  @ApiProperty()
  carbs: number;

  @ApiProperty()
  fats: number;

  @ApiPropertyOptional()
  averageCost?: number | null;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  createdByUserId?: string | null;

  @ApiProperty()
  isCustom: boolean;

  @ApiProperty()
  isVerified: boolean;
}
