import { loadLlmConfigFromEnv } from './llm.config';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROK_MODEL,
  DEFAULT_LLM_PROVIDER_ORDER,
} from './llm.constants';
import { GeminiProvider } from './providers/gemini.provider';
import { GrokProvider } from './providers/grok.provider';
import { isQuotaExceededError, isRetryableLlmError, retryDelayMs, sleep } from './retry.util';
import type {
  LlmConfig,
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmLogger,
  LlmMetadata,
  LlmProvider,
  LlmProviderAdapter,
} from './llm.types';

export class LlmClient {
  private readonly providers: LlmProviderAdapter[];
  private lastUsedProvider: LlmProvider | null = null;
  private lastUsedModel = '';

  constructor(
    private readonly config: LlmConfig,
    private readonly logger?: LlmLogger,
  ) {
    this.providers = this.buildProviders();
    this.lastUsedModel = this.getDefaultModel();
  }

  static fromEnv(logger?: LlmLogger): LlmClient {
    return new LlmClient(loadLlmConfigFromEnv(), logger);
  }

  isConfigured(): boolean {
    return this.providers.some((provider) => provider.isConfigured());
  }

  getProviderOrder(): LlmProvider[] {
    return [...this.config.providerOrder];
  }

  getConfiguredProviders(): LlmProvider[] {
    return this.providers
      .filter((provider) => provider.isConfigured())
      .map((provider) => provider.name);
  }

  getLastUsedProvider(): LlmProvider | null {
    return this.lastUsedProvider;
  }

  getLastUsedModel(): string {
    return this.lastUsedModel;
  }

  /** Primary model for the first configured provider (backward compat). */
  getModel(): string {
    return this.getDefaultModel();
  }

  buildMetadata(promptVersion: number): LlmMetadata {
    return {
      provider: this.lastUsedProvider ?? this.config.providerOrder[0],
      model: this.lastUsedModel || this.getDefaultModel(),
      promptVersion,
    };
  }

  async generate(options: LlmGenerateOptions): Promise<string> {
    const result = await this.generateWithMetadata(options);
    return result.text;
  }

  async generateJson<T>(prompt: string): Promise<T> {
    const text = await this.generate({
      prompt,
      responseMimeType: 'application/json',
    });

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('AI service returned invalid JSON');
      }
      throw error;
    }
  }

  async generateWithMetadata(
    options: LlmGenerateOptions,
  ): Promise<LlmGenerateResult> {
    if (!this.isConfigured()) {
      throw new Error(
        'No LLM provider configured. Set GEMINI_API_KEY and/or GROK_API_KEY.',
      );
    }

    let lastError: unknown;

    for (const provider of this.providers) {
      if (!provider.isConfigured()) {
        continue;
      }

      let skipProvider = false;

      for (const model of provider.getModels()) {
        if (skipProvider) {
          break;
        }

        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
          try {
            if (attempt === 0) {
              this.logger?.('warn', `trying ${provider.name} ${model}...`);
            }

            const text = await provider.generate({
              prompt: options.prompt,
              model,
              responseMimeType: options.responseMimeType,
            });

            if (model !== provider.getModels()[0]) {
              this.logger?.(
                'warn',
                `${provider.name} fell back from ${provider.getModels()[0]} to ${model}`,
              );
            }

            this.lastUsedProvider = provider.name;
            this.lastUsedModel = model;

            return {
              text,
              provider: provider.name,
              model,
            };
          } catch (error) {
            lastError = error;

            if (isQuotaExceededError(error)) {
              this.logger?.(
                'warn',
                `${provider.name} quota exceeded, skipping to next provider`,
              );
              skipProvider = true;
              break;
            }

            if (!isRetryableLlmError(error)) {
              this.logger?.(
                'warn',
                `${provider.name} ${model} failed: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
              break;
            }

            const waitMs = retryDelayMs(attempt);
            this.logger?.(
              'warn',
              `${provider.name} ${model} attempt ${attempt + 1}/${this.config.maxRetries} failed: ${
                error instanceof Error ? error.message : String(error)
              }; retrying in ${waitMs}ms`,
            );

            if (attempt < this.config.maxRetries - 1) {
              await sleep(waitMs);
            }
          }
        }

        const nextModel = provider.getModels().at(-1);
        if (model !== nextModel) {
          this.logger?.(
            'warn',
            `${provider.name} model ${model} unavailable, trying next fallback`,
          );
        }
      }

      const nextProvider = this.getNextConfiguredProvider(provider.name);
      if (nextProvider) {
        this.logger?.(
          'warn',
          `${provider.name} unavailable, switching to ${nextProvider}`,
        );
      }
    }

    this.logger?.(
      'error',
      'All LLM providers failed',
      lastError instanceof Error ? lastError.stack : lastError,
    );

    const lastMessage =
      lastError instanceof Error
        ? lastError.message
        : 'AI service temporarily unavailable';

    if (isRetryableLlmError(lastError)) {
      throw new Error(
        'AI service is temporarily overloaded. Please try again in a few moments.',
      );
    }

    throw new Error(lastMessage);
  }

  private buildProviders(): LlmProviderAdapter[] {
    const byName: Record<LlmProvider, LlmProviderAdapter> = {
      gemini: new GeminiProvider(this.config.gemini),
      grok: new GrokProvider(this.config.grok),
    };

    return this.config.providerOrder.map((name) => byName[name]);
  }

  private getDefaultModel(): string {
    for (const provider of this.providers) {
      if (provider.isConfigured()) {
        return provider.getModels()[0];
      }
    }

    const primary = this.config.providerOrder[0];
    return primary === 'grok' ? DEFAULT_GROK_MODEL : DEFAULT_GEMINI_MODEL;
  }

  private getNextConfiguredProvider(
    current: LlmProvider,
  ): LlmProvider | undefined {
    const order =
      this.config.providerOrder.length > 0
        ? this.config.providerOrder
        : [...DEFAULT_LLM_PROVIDER_ORDER];

    const startIndex = order.indexOf(current);
    for (let index = startIndex + 1; index < order.length; index += 1) {
      const name = order[index];
      const provider = this.providers.find((entry) => entry.name === name);
      if (provider?.isConfigured()) {
        return name;
      }
    }

    return undefined;
  }
}
