import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class DietPlannerQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-03',
    description: 'ISO date (defaults to today in server timezone)',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
