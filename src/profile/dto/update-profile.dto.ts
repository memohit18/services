import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * PATCH /profile — partial user profile update.
 * Pass `imageUrl` or `avatar` (same field) after uploading via POST /images.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Mohit Sharma' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/uploads/userId/profile/uuid/medium.webp',
    description: 'Public image URL (from POST /images). Alias of avatar.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/uploads/userId/profile/uuid/medium.webp',
    description: 'Same as imageUrl — either key is accepted.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2048)
  avatar?: string | null;
}
