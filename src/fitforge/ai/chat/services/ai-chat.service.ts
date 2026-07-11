import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { CreateAiSessionDto } from '../dto/create-ai-session.dto';
import { SendAiMessageDto } from '../dto/send-ai-message.dto';
import { ConversationService } from './conversation.service';

/** Thin facade — Phase 8.3 ConversationService is the source of truth. */
@Injectable()
export class AiChatService {
  constructor(private readonly conversations: ConversationService) {}

  createSession(userId: string, dto: CreateAiSessionDto) {
    return this.conversations.createSession(userId, dto);
  }

  listSessions(userId: string, query: PaginationQueryDto) {
    return this.conversations.listSessions(userId, query);
  }

  getSession(userId: string, sessionId: string) {
    return this.conversations.getSession(userId, sessionId);
  }

  getMessages(userId: string, sessionId: string, query: PaginationQueryDto) {
    return this.conversations.getMessages(userId, sessionId, query);
  }

  getHistory(userId: string, query: PaginationQueryDto) {
    return this.conversations.getHistory(userId, query);
  }

  deleteHistory(userId: string, id: string) {
    return this.conversations.deleteHistory(userId, id);
  }

  sendMessage(userId: string, sessionId: string, dto: SendAiMessageDto) {
    return this.conversations.sendMessage(userId, sessionId, dto);
  }

  chat(userId: string, sessionId: string | undefined, message: string) {
    return this.conversations.chat(userId, message, sessionId);
  }
}
