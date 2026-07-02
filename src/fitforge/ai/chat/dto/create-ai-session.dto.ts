import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAiSessionDto {
  @ApiPropertyOptional({ example: 'Meal replacements' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}
