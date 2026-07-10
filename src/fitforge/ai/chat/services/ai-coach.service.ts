import { Injectable } from '@nestjs/common';
import type { AiMessage } from '@prisma/client';
import { GeminiService } from '../../gemini/gemini.service';
import { AIContextBuilder } from './ai-context.builder';
import { PromptBuilder } from './prompt.builder';

@Injectable()
export class AiCoachService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly contextBuilder: AIContextBuilder,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  async chat(
    userId: string,
    _sessionId: string,
    userMessage: string,
    history: AiMessage[],
  ): Promise<{ reply: string; contextVersion: string }> {
    const ctx = await this.contextBuilder.build(userId);
    const prompt = this.promptBuilder.build(ctx, history, userMessage);
    const reply = await this.gemini.generate(prompt);
    return { reply, contextVersion: ctx.contextVersion };
  }
}
