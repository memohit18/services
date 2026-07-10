import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PartialMealDto {
  @ApiProperty({ example: 0.5, description: 'Fraction of meal consumed (0–1 exclusive of ends)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(0.99)
  consumedQuantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
