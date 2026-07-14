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

/**
 * Delete by folder path, object key, or public URL.
 * Deletes all R2 variants for that image + the MongoDB document.
 */
export class DeleteImageByPathDto {
  @ApiPropertyOptional({
    example: 'uploads/USER_ID/food/IMAGE_ID',
    description: 'R2 folder path from upload response (folderPath)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  path?: string;

  @ApiPropertyOptional({
    example: 'uploads/USER_ID/food/IMAGE_ID',
    description: 'Alias of path',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  folderPath?: string;

  @ApiPropertyOptional({
    example:
      'https://cdn.example.com/uploads/USER_ID/food/IMAGE_ID/medium.webp',
    description: 'Any variant public URL — server resolves the folder',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;
}
