import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

/** PRD-aligned chat body: POST /ai/chat */
export class AiChatDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sessionId: string;

  @ApiProperty({ example: 'I skipped breakfast' })
  @IsString()
  @MinLength(1)
  message: string;
}
