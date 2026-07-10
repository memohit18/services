import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CompleteMealDto {
  @ApiPropertyOptional({ example: 1.0, description: 'Portion consumed (default 1.0)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(2)
  consumedQuantity?: number;

  @ApiPropertyOptional({ example: 'Finished all' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
