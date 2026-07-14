import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Body for POST /fitness/goals */
export class CreateFitnessGoalApiDto {
  @ApiProperty({
    example: 'Lean',
    description: 'Display title (also used to build slug id)',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  title!: string;

  @ApiPropertyOptional({ example: 'Visible abs, low body fat' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: 'https://cdn.example.com/uploads/.../medium.webp',
    description: 'Public image URL — upload via POST /images first',
  })
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl!: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetBodyFatMin?: number;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetBodyFatMax?: number;
}

/** Body for PATCH /fitness/goals/:id — typically just imageUrl */
export class UpdateFitnessGoalApiDto {
  @ApiPropertyOptional({ example: 'Lean' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  title?: string;

  @ApiPropertyOptional({ example: 'Visible abs, low body fat' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/uploads/.../medium.webp',
    description: 'Replace goal card image',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetBodyFatMin?: number;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetBodyFatMax?: number;
}
