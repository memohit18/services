import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ConfirmUploadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  uploadId: string;

  @ApiProperty()
  @IsString()
  fileUrl: string;

  @ApiProperty({ example: 245000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  size: number;

  @ApiPropertyOptional({ enum: ['front', 'side', 'back'] })
  @IsOptional()
  @IsIn(['front', 'side', 'back'])
  photoType?: string;
}
