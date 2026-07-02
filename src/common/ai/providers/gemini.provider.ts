import { GoogleGenAI } from '@google/genai';
import type { LlmProviderAdapter } from '../llm.types';
import type { LlmProviderConfig } from '../llm.types';

export class GeminiProvider implements LlmProviderAdapter {
  readonly name = 'gemini' as const;
  private readonly client: GoogleGenAI | null;

  constructor(private readonly config: LlmProviderConfig) {
    this.client = config.apiKey ? new GoogleGenAI({ apiKey: config.apiKey }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getModels(): string[] {
    return [this.config.model, ...this.config.fallbackModels];
  }

  async generate(input: {
    prompt: string;
    model: string;
    responseMimeType?: 'application/json';
  }): Promise<string> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const response = await this.client.models.generateContent({
      model: input.model,
      contents: input.prompt,
      config: input.responseMimeType
        ? { responseMimeType: input.responseMimeType }
        : undefined,
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error('Gemini returned an empty response');
    }

    return text;
  }
}
