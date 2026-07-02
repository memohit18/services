import { Module } from '@nestjs/common';
import { AiSharedModule } from '../shared/ai-shared.module';
import { AiChatController } from './routes/ai-chat.controller';
import { AiChatService } from './services/ai-chat.service';
import { AiCoachService } from './services/ai-coach.service';

@Module({
  imports: [AiSharedModule],
  controllers: [AiChatController],
  providers: [AiChatService, AiCoachService],
  exports: [AiChatService, AiSharedModule],
})
export class AiChatModule {}
