import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmClient } from './llm.client';
import { loadLlmConfigFromNestConfig } from './llm.config';
import type { LlmMetadata, LlmProvider } from './llm.types';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: LlmClient;

  constructor(config: ConfigService) {
    this.client = new LlmClient(loadLlmConfigFromNestConfig(config), (level, message, context) => {
      if (level === 'warn') {
        this.logger.warn(message);
        return;
      }

      if (context) {
        this.logger.error(message, context);
        return;
      }

      this.logger.error(message);
    });
  }

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  getProviderOrder(): LlmProvider[] {
    return this.client.getProviderOrder();
  }

  getConfiguredProviders(): LlmProvider[] {
    return this.client.getConfiguredProviders();
  }

  getModel(): string {
    return this.client.getModel();
  }

  getLastUsedProvider(): LlmProvider | null {
    return this.client.getLastUsedProvider();
  }

  getLastUsedModel(): string {
    return this.client.getLastUsedModel();
  }

  buildMetadata(promptVersion: number): LlmMetadata {
    return this.client.buildMetadata(promptVersion);
  }

  async generate(prompt: string): Promise<string> {
    try {
      return await this.client.generate({ prompt });
    } catch (error) {
      this.handleError('generate', error);
    }
  }

  async generateJson<T>(prompt: string): Promise<T> {
    try {
      return await this.client.generateJson<T>(prompt);
    } catch (error) {
      if (error instanceof Error && error.message.includes('invalid JSON')) {
        this.logger.error('LLM JSON parse failed');
        throw new ServiceUnavailableException('AI service returned invalid JSON');
      }

      this.handleError('generateJson', error);
    }
  }

  private handleError(operation: string, error: unknown): never {
    if (error instanceof ServiceUnavailableException) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes('temporarily overloaded') ||
      message.includes('temporarily unavailable')
    ) {
      throw new ServiceUnavailableException(message);
    }

    this.logger.error(
      `LLM ${operation} failed`,
      error instanceof Error ? error.stack : error,
    );
    throw new ServiceUnavailableException('AI service temporarily unavailable');
  }
}
