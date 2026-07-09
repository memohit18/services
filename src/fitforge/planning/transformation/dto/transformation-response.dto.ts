import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransformationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 27.3 })
  bmi: number;

  @ApiProperty({ example: 1765 })
  bmr: number;

  @ApiProperty({ example: 2640 })
  tdee: number;

  @ApiProperty({ example: 2140 })
  calories: number;

  @ApiProperty({ example: 165 })
  protein: number;

  @ApiProperty({ example: 20 })
  estimatedWeeks: number;

  @ApiProperty({ example: 85 })
  currentWeightKg: number;

  @ApiProperty({ example: 75 })
  targetWeightKg: number;

  @ApiPropertyOptional({ example: 24 })
  currentBodyFat: number | null;

  @ApiPropertyOptional({ example: 12 })
  targetBodyFat: number | null;

  @ApiPropertyOptional({ example: 'Lean' })
  targetPhysique: string | null;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
