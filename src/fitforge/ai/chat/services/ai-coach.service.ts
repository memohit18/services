import { Injectable } from '@nestjs/common';
import type { AiMessage } from '@prisma/client';
import { GeminiService } from '../../gemini/gemini.service';
import { AiContextService } from '../../shared/ai-context.service';

@Injectable()
export class AiCoachService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly contextService: AiContextService,
  ) {}

  async chat(
    userId: string,
    sessionId: string,
    userMessage: string,
    history: AiMessage[],
  ): Promise<string> {
    const ctx = await this.contextService.buildCoachContext(userId);
    const prompt = this.contextService.buildCoachPrompt(ctx, history, userMessage);
    return this.gemini.generate(prompt);
  }
}
