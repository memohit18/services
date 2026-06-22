import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class PresignedUploadDto {
  @ApiProperty({ example: 'progress-front.jpg' })
  @IsString()
  @MinLength(3)
  fileName: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  contentType: string;

  @ApiPropertyOptional({ enum: ['front', 'side', 'back', 'general'] })
  @IsOptional()
  @IsIn(['front', 'side', 'back', 'general'])
  photoType?: string;
}
