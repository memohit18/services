import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class ReplaceMealExecutionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  foodId!: string;

  @ApiPropertyOptional({ example: 1, description: 'Serving multiplier' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  quantity?: number;
}
