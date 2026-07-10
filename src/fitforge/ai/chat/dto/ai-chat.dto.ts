import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/** PRD-aligned chat body: POST /ai/chat */
export class AiChatDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Omit to auto-create a new session',
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiProperty({ example: 'I skipped breakfast.' })
  @IsString()
  @MinLength(1)
  message: string;
}
