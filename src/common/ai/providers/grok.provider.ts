import type { GrokProviderConfig, LlmProviderAdapter } from '../llm.types';
import { isGroqApiKey } from '../llm.config';

type GrokChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type GrokResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

export class GrokProvider implements LlmProviderAdapter {
  readonly name = 'grok' as const;

  constructor(private readonly config: GrokProviderConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  validateConfiguration(): string | null {
    const key = this.config.apiKey;
    if (!key) {
      if (process.env.GROK_API_KEY?.trim() && isGroqApiKey(process.env.GROK_API_KEY)) {
        return (
          'GROK_API_KEY is a Groq key (gsk_...). Set XAI_API_KEY with your key from https://console.x.ai ' +
          'and remove or clear the Groq key from GROK_API_KEY.'
        );
      }
      return 'XAI_API_KEY (or GROK_API_KEY) is not set';
    }
    if (isGroqApiKey(key)) {
      return (
        'xAI key looks like a Groq key (gsk_...). Use XAI_API_KEY from https://console.x.ai.'
      );
    }
    if (!key.startsWith('xai-')) {
      return (
        'xAI API keys must start with xai- (from https://console.x.ai/team/default/api-keys). ' +
        'Check XAI_API_KEY for typos or paste the full key from key creation.'
      );
    }
    return null;
  }

  getModels(): string[] {
    return [this.config.model, ...this.config.fallbackModels];
  }

  async generate(input: {
    prompt: string;
    model: string;
    responseMimeType?: 'application/json';
  }): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('XAI_API_KEY is not configured');
    }

    const configError = this.validateConfiguration();
    if (configError) {
      throw new Error(configError);
    }

    try {
      return await this.generateViaResponses(input);
    } catch (responsesError) {
      try {
        return await this.generateViaChatCompletions(input);
      } catch (chatError) {
        const responsesMessage =
          responsesError instanceof Error ? responsesError.message : String(responsesError);
        const chatMessage =
          chatError instanceof Error ? chatError.message : String(chatError);
        throw new Error(`${responsesMessage} (chat/completions fallback: ${chatMessage})`);
      }
    }
  }

  private async generateViaResponses(input: {
    prompt: string;
    model: string;
    responseMimeType?: 'application/json';
  }): Promise<string> {
    const body: Record<string, unknown> = {
      model: input.model,
      input: [{ role: 'user', content: input.prompt }],
    };

    if (input.responseMimeType === 'application/json') {
      body.text = {
        format: { type: 'json_object' },
      };
    }

    const payload = await this.postJson<GrokResponsesPayload>('/responses', body);
    const text = this.extractResponsesText(payload);
    if (!text) {
      throw new Error('Grok /responses returned an empty response');
    }

    return text;
  }

  private async generateViaChatCompletions(input: {
    prompt: string;
    model: string;
    responseMimeType?: 'application/json';
  }): Promise<string> {
    const body: Record<string, unknown> = {
      model: input.model,
      messages: [{ role: 'user', content: input.prompt }],
    };

    if (
      input.responseMimeType === 'application/json' &&
      process.env.GROK_USE_JSON_RESPONSE_FORMAT === 'true'
    ) {
      body.response_format = { type: 'json_object' };
    }

    const payload = await this.postJson<GrokChatResponse>('/chat/completions', body);
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('Grok /chat/completions returned an empty response');
    }

    return text;
  }

  private extractResponsesText(payload: GrokResponsesPayload): string | undefined {
    if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
      return payload.output_text.trim();
    }

    for (const item of payload.output ?? []) {
      for (const part of item.content ?? []) {
        if (part.text?.trim()) {
          return part.text.trim();
        }
      }
    }

    return undefined;
  }

  private async postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeoutMs = Number(process.env.LLM_REQUEST_TIMEOUT_MS ?? 120_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const raw = await response.text();
      let payload: T & { error?: { message?: string } } = {} as T & {
        error?: { message?: string };
      };
      try {
        payload = raw ? (JSON.parse(raw) as T & { error?: { message?: string } }) : ({} as T);
      } catch {
        payload = {} as T;
      }

      if (!response.ok) {
        const apiMessage =
          payload.error?.message ??
          (typeof (payload as { error?: unknown }).error === 'string'
            ? String((payload as { error: string }).error)
            : undefined) ??
          raw.slice(0, 300);
        throw new Error(
          apiMessage
            ? `Grok ${response.status}: ${apiMessage}`
            : `Grok request failed with status ${response.status}`,
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Grok request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
