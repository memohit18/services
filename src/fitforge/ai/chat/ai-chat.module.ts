import { Module } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module';
import { ConversationRepository } from './repositories/conversation.repository';
import { AiChatController } from './routes/ai-chat.controller';
import { AIContextBuilder } from './services/ai-context.builder';
import { AiChatService } from './services/ai-chat.service';
import { AiCoachService } from './services/ai-coach.service';
import { ConversationService } from './services/conversation.service';
import { PromptBuilder } from './services/prompt.builder';
import { CoachReplyValidator } from './validators/coach-reply.validator';

@Module({
  imports: [GeminiModule],
  controllers: [AiChatController],
  providers: [
    ConversationRepository,
    ConversationService,
    AiChatService,
    AiCoachService,
    AIContextBuilder,
    PromptBuilder,
    CoachReplyValidator,
  ],
  exports: [
    ConversationService,
    AiChatService,
    AIContextBuilder,
    PromptBuilder,
  ],
})
export class AiChatModule {}
