import { Injectable, NotFoundException } from '@nestjs/common';
import type { AiMessage } from '@prisma/client';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { PrismaService } from '../../../../prisma/prisma.service';
import { GeminiService } from '../../gemini/gemini.service';
import { CreateAiSessionDto } from '../dto/create-ai-session.dto';
import { SendAiMessageDto } from '../dto/send-ai-message.dto';
import { AIContextBuilder } from './ai-context.builder';
import { PromptBuilder } from './prompt.builder';

/**
 * ConversationService — persists Q/A with context version.
 * AI only receives PromptBuilder output (never raw DB access).
 */
@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextBuilder: AIContextBuilder,
    private readonly promptBuilder: PromptBuilder,
    private readonly gemini: GeminiService,
  ) {}

  async createSession(userId: string, dto: CreateAiSessionDto) {
    return this.prisma.aiChatSession.create({
      data: { userId, title: dto.title },
    });
  }

  async listSessions(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.aiChatSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.aiChatSession.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId },
    });
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
    const where = { sessionId };
    const [items, total] = await Promise.all([
      this.prisma.aiMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.aiMessage.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async getContextMessages(
    sessionId: string,
    limit = 50,
  ): Promise<AiMessage[]> {
    return this.prisma.aiMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async sendMessage(
    userId: string,
    sessionId: string,
    dto: SendAiMessageDto,
  ) {
    const session = await this.getSession(userId, sessionId);
    const priorCount = await this.prisma.aiMessage.count({
      where: { sessionId },
    });

    const userMessage = await this.prisma.aiMessage.create({
      data: { sessionId, role: 'user', content: dto.content },
    });

    const history = await this.getContextMessages(sessionId);
    const ctx = await this.contextBuilder.build(userId);
    const prompt = this.promptBuilder.build(ctx, history, dto.content);
    const assistantContent = await this.gemini.generate(prompt);

    const assistantMessage = await this.prisma.aiMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: assistantContent,
        contextVersion: ctx.contextVersion,
      },
    });

    if (priorCount === 0 && !session.title) {
      await this.prisma.aiChatSession.update({
        where: { id: sessionId },
        data: { title: dto.content.slice(0, 80) },
      });
    }

    return {
      userMessage,
      assistantMessage,
      response: assistantContent,
      contextVersion: ctx.contextVersion,
      timestamp: assistantMessage.createdAt,
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
      question: message,
      answer: result.response,
      contextVersion: result.contextVersion,
      timestamp: result.timestamp,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
      response: result.response,
    };
  }
}
