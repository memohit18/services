import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UploadImageDto {
  @ApiProperty({
    example: 'profile',
    description: 'Free-form image type (food, profile, progress, grocery, …)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'type may only contain letters, numbers, dots, underscores, dashes',
  })
  type!: string;
}

export class ListImagesQueryDto {
  @ApiPropertyOptional({ example: 'food' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  type?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
