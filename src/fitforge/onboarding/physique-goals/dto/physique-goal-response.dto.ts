import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PhysiqueGoalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiPropertyOptional()
  targetBodyFatMin?: number | null;

  @ApiPropertyOptional()
  targetBodyFatMax?: number | null;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiProperty()
  createdAt: Date;
}
