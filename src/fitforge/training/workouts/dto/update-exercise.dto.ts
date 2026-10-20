import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateExerciseDto {
  @ApiPropertyOptional({
    nullable: true,
    example:
      'https://cdn.example.com/uploads/userId/workout/uuid/medium.webp',
    description:
      'Public image or GIF URL from POST /images (type=workout). Pass null to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;
}
