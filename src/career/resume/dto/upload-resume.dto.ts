import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadResumeDto {
  @ApiPropertyOptional({
    example: 'Software Engineer Resume',
    description: 'Display title; defaults to original file name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
