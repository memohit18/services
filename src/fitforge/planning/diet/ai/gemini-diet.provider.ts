import { Injectable } from '@nestjs/common';
import { GeminiService } from '../../../ai/gemini/gemini.service';
import type { DietAiProvider } from './diet-ai.provider';

/**
 * Gemini-backed diet provider.
 * Future: DeepSeekProvider / OpenAIProvider implementing the same interface.
 */
@Injectable()
export class GeminiDietProvider implements DietAiProvider {
  readonly name = 'gemini';

  constructor(private readonly gemini: GeminiService) {}

  async generateDiet(prompt: string): Promise<unknown> {
    return this.gemini.generateJson<unknown>(prompt);
  }
}
