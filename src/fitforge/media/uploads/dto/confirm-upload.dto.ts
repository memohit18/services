import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ConfirmUploadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  uploadId: string;

  @ApiProperty()
  @IsString()
  fileUrl: string;

  @ApiPropertyOptional({ enum: ['front', 'side', 'back'] })
  @IsOptional()
  @IsIn(['front', 'side', 'back'])
  photoType?: string;
}
