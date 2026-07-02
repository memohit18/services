import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LlmService } from '../../../common/ai/llm.service';
import type { LlmMetadata, LlmProvider } from '../../../common/ai/llm.types';

/**
 * Backward-compatible alias for {@link LlmService}.
 * Existing FitForge services inject GeminiService; it delegates to the shared LLM layer.
 */
@Injectable()
export class GeminiService {
  constructor(private readonly llm: LlmService) {}

  isConfigured(): boolean {
    return this.llm.isConfigured();
  }

  getModel(): string {
    return this.llm.getModel();
  }

  getLastUsedModel(): string {
    return this.llm.getLastUsedModel();
  }

  getLastUsedProvider(): LlmProvider | null {
    return this.llm.getLastUsedProvider();
  }

  buildMetadata(promptVersion: number): LlmMetadata {
    return this.llm.buildMetadata(promptVersion);
  }

  async generate(prompt: string): Promise<string> {
    return this.llm.generate(prompt);
  }

  async generateJson<T>(prompt: string): Promise<T> {
    return this.llm.generateJson<T>(prompt);
  }

  /** @deprecated Use isConfigured() — kept for callers that checked Gemini only */
  requireConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'No LLM provider configured. Set GEMINI_API_KEY and/or GROK_API_KEY.',
      );
    }
  }
}
