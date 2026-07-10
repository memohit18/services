import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateProgressDto {
  @ApiPropertyOptional({ example: 78 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(400)
  weightKg?: number;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(3)
  @Max(60)
  bodyFatPercentage?: number;

  @ApiPropertyOptional({ example: 82 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(40)
  @Max(200)
  waistCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(40)
  @Max(200)
  chestCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(15)
  @Max(80)
  armCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(120)
  thighCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
