import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SendAiMessageDto {
  @ApiProperty({ example: "I don't like oats — what can I eat instead?" })
  @IsString()
  @MinLength(1)
  content: string;
}
