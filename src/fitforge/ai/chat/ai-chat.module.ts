import { Module } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module';
import { AiChatController } from './routes/ai-chat.controller';
import { AIContextBuilder } from './services/ai-context.builder';
import { AiChatService } from './services/ai-chat.service';
import { AiCoachService } from './services/ai-coach.service';
import { ConversationService } from './services/conversation.service';
import { PromptBuilder } from './services/prompt.builder';

@Module({
  imports: [GeminiModule],
  controllers: [AiChatController],
  providers: [
    ConversationService,
    AiChatService,
    AiCoachService,
    AIContextBuilder,
    PromptBuilder,
  ],
  exports: [
    ConversationService,
    AiChatService,
    AIContextBuilder,
    PromptBuilder,
  ],
})
export class AiChatModule {}
