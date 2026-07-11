import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  createSession(userId: string, title?: string) {
    return this.prisma.aiChatSession.create({
      data: { userId, title },
    });
  }

  findSession(userId: string, sessionId: string) {
    return this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId },
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
    return { items, total, page, limit };
  }

  updateSessionTitle(sessionId: string, title: string) {
    return this.prisma.aiChatSession.update({
      where: { id: sessionId },
      data: { title },
    });
  }

  createMessage(data: Prisma.AiMessageUncheckedCreateInput) {
    return this.prisma.aiMessage.create({ data });
  }

  countMessages(sessionId: string) {
    return this.prisma.aiMessage.count({ where: { sessionId } });
  }

  getMessages(sessionId: string, opts: { skip: number; take: number }) {
    return Promise.all([
      this.prisma.aiMessage.findMany({
        where: { sessionId },
        skip: opts.skip,
        take: opts.take,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.aiMessage.count({ where: { sessionId } }),
    ]);
  }

  getContextMessages(sessionId: string, limit = 50) {
    return this.prisma.aiMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Flattened Q/A history across sessions (assistant rows drive the pair).
   */
  async listHistory(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where = {
      role: 'assistant',
      session: { userId },
    };
    const [assistants, total] = await Promise.all([
      this.prisma.aiMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { session: { select: { id: true, title: true } } },
      }),
      this.prisma.aiMessage.count({ where }),
    ]);

    const pairs = await Promise.all(
      assistants.map(async (assistant) => {
        const question = await this.prisma.aiMessage.findFirst({
          where: {
            sessionId: assistant.sessionId,
            role: 'user',
            createdAt: { lte: assistant.createdAt },
          },
          orderBy: { createdAt: 'desc' },
        });
        return {
          id: assistant.id,
          sessionId: assistant.sessionId,
          sessionTitle: assistant.session.title,
          question: question?.content ?? '',
          answer: assistant.content,
          timestamp: assistant.createdAt,
          contextVersion: assistant.contextVersion,
          questionMessageId: question?.id ?? null,
        };
      }),
    );

    return { items: pairs, total, page, limit };
  }

  async deleteHistoryEntry(userId: string, id: string) {
    // Prefer treating id as an assistant message (Q/A turn).
    const assistant = await this.prisma.aiMessage.findFirst({
      where: { id, role: 'assistant', session: { userId } },
      include: { session: true },
    });

    if (assistant) {
      const question = await this.prisma.aiMessage.findFirst({
        where: {
          sessionId: assistant.sessionId,
          role: 'user',
          createdAt: { lte: assistant.createdAt },
        },
        orderBy: { createdAt: 'desc' },
      });

      await this.prisma.$transaction([
        ...(question
          ? [this.prisma.aiMessage.delete({ where: { id: question.id } })]
          : []),
        this.prisma.aiMessage.delete({ where: { id: assistant.id } }),
      ]);

      const remaining = await this.prisma.aiMessage.count({
        where: { sessionId: assistant.sessionId },
      });
      if (remaining === 0) {
        await this.prisma.aiChatSession.delete({
          where: { id: assistant.sessionId },
        });
      }

      return {
        deleted: 'turn' as const,
        id: assistant.id,
        sessionId: assistant.sessionId,
        sessionDeleted: remaining === 0,
      };
    }

    // Fallback: delete whole session by id
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id, userId },
    });
    if (!session) {
      return null;
    }

    await this.prisma.$transaction([
      this.prisma.aiMessage.deleteMany({ where: { sessionId: session.id } }),
      this.prisma.aiChatSession.delete({ where: { id: session.id } }),
    ]);

    return {
      deleted: 'session' as const,
      id: session.id,
      sessionId: session.id,
      sessionDeleted: true,
    };
  }
}
