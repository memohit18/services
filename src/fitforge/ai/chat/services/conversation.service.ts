import { Injectable, NotFoundException } from '@nestjs/common';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { GeminiService } from '../../gemini/gemini.service';
import { CreateAiSessionDto } from '../dto/create-ai-session.dto';
import { SendAiMessageDto } from '../dto/send-ai-message.dto';
import { ConversationRepository } from '../repositories/conversation.repository';
import { CoachReplyValidator } from '../validators/coach-reply.validator';
import { AIContextBuilder } from './ai-context.builder';
import { PromptBuilder } from './prompt.builder';

/**
 * ConversationService — Context → Prompt → Gemini → Validator → Storage.
 * AI only receives PromptBuilder output (never raw DB access).
 */
@Injectable()
export class ConversationService {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly contextBuilder: AIContextBuilder,
    private readonly promptBuilder: PromptBuilder,
    private readonly gemini: GeminiService,
    private readonly replyValidator: CoachReplyValidator,
  ) {}

  async createSession(userId: string, dto: CreateAiSessionDto) {
    return this.repository.createSession(userId, dto.title);
  }

  async listSessions(userId: string, query: PaginationQueryDto) {
    const { items, total, page, limit } = await this.repository.listSessions(
      userId,
      query,
    );
    return paginatedResponse(items, total, page, limit);
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.repository.findSession(userId, sessionId);
    if (!session) {
      throw new NotFoundException('Chat session not found');
    }
    return session;
  }

  async getMessages(
    userId: string,
    sessionId: string,
    query: PaginationQueryDto,
  ) {
    await this.getSession(userId, sessionId);
    const { page, limit, skip } = getPagination(query);
    const [items, total] = await this.repository.getMessages(sessionId, {
      skip,
      take: limit,
    });
    return paginatedResponse(items, total, page, limit);
  }

  async getHistory(userId: string, query: PaginationQueryDto) {
    const { items, total, page, limit } = await this.repository.listHistory(
      userId,
      query,
    );
    return paginatedResponse(items, total, page, limit);
  }

  async deleteHistory(userId: string, id: string) {
    const result = await this.repository.deleteHistoryEntry(userId, id);
    if (!result) {
      throw new NotFoundException('Chat history not found');
    }
    return result;
  }

  async sendMessage(
    userId: string,
    sessionId: string,
    dto: SendAiMessageDto,
  ) {
    const session = await this.getSession(userId, sessionId);
    const priorCount = await this.repository.countMessages(sessionId);
    const contextVersion = this.contextBuilder.getContextVersion();

    const userMessage = await this.repository.createMessage({
      sessionId,
      role: 'user',
      content: dto.content,
      contextVersion,
    });

    const history = await this.repository.getContextMessages(sessionId);
    const ctx = await this.contextBuilder.build(userId);
    const prompt = this.promptBuilder.build(ctx, history, dto.content);
    const rawReply = await this.gemini.generate(prompt);
    const validated = this.replyValidator.validate(rawReply);

    const assistantMessage = await this.repository.createMessage({
      sessionId,
      role: 'assistant',
      content: validated.content,
      contextVersion: ctx.contextVersion,
    });

    if (priorCount === 0 && !session.title) {
      await this.repository.updateSessionTitle(
        sessionId,
        dto.content.slice(0, 80),
      );
    }

    return {
      question: dto.content,
      answer: validated.content,
      userMessage,
      assistantMessage,
      response: validated.content,
      contextVersion: ctx.contextVersion,
      timestamp: assistantMessage.createdAt,
      validation: {
        valid: validated.valid,
        warnings: validated.warnings,
      },
    };
  }

  /** POST /ai/chat — auto-creates session when sessionId omitted */
  async chat(userId: string, message: string, sessionId?: string) {
    let sid = sessionId;
    if (!sid) {
      const session = await this.createSession(userId, {
        title: message.slice(0, 80),
      });
      sid = session.id;
    }
    const result = await this.sendMessage(userId, sid, { content: message });
    return {
      sessionId: sid,
      question: result.question,
      answer: result.answer,
      contextVersion: result.contextVersion,
      timestamp: result.timestamp,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
      response: result.response,
      validation: result.validation,
    };
  }
}
