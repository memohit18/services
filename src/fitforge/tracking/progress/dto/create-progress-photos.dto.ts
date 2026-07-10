import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

/**
 * Create a progress photo set. Pass public R2 URLs after uploading via
 * POST /uploads/presigned-url → PUT to R2 → (optional) POST /uploads/confirm.
 * At least one of front/side/back is required.
 */
export class CreateProgressPhotosDto {
  @ApiPropertyOptional({ example: 'https://cdn.example.com/uploads/.../front.jpg' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({ require_tld: false })
  frontImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({ require_tld: false })
  sideImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({ require_tld: false })
  backImageUrl?: string;

  @ApiPropertyOptional({ description: 'Optional note stored nowhere yet — reserved' })
  @IsOptional()
  @IsString()
  notes?: string;
}
