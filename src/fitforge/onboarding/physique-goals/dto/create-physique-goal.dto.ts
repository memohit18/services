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

export class CreatePhysiqueGoalDto {
  @ApiProperty({ example: 'Athletic' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name: string;

  @ApiPropertyOptional({ example: 'Lean and functional' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetBodyFatMin?: number;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetBodyFatMax?: number;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/uploads/.../medium.webp',
    description: 'Public image URL (e.g. from POST /images)',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'imageUrl must be a valid URL' })
  @MaxLength(2048)
  imageUrl?: string;
}
