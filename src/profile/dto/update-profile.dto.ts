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
 * To change password, send `newPassword` (+ `currentPassword` if one is already set).
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

  @ApiPropertyOptional({
    example: 'OldPass123!',
    description: 'Required when changing password if the account already has one.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword?: string;

  @ApiPropertyOptional({
    example: 'NewPass123!',
    description: 'New password (min 8 chars). Requires currentPassword when one exists.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword?: string;
}
