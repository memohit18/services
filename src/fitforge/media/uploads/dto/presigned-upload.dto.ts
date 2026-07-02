import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { UPLOAD_CATEGORIES } from '../../../../../db-schema/postgres/constants/fitforge-values';

export class PresignedUploadDto {
  @ApiProperty({ example: 'progress-front.jpg' })
  @IsString()
  @MinLength(3)
  fileName: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  contentType: string;

  @ApiProperty({ enum: UPLOAD_CATEGORIES, example: 'progress' })
  @IsIn(UPLOAD_CATEGORIES)
  category: string;

  @ApiPropertyOptional({ example: 245000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  size?: number;

  @ApiPropertyOptional({ enum: ['front', 'side', 'back'], description: 'Progress photo slot' })
  @IsOptional()
  @IsIn(['front', 'side', 'back'])
  photoType?: string;
}
