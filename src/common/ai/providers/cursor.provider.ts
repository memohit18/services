import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Agent } from '@cursor/sdk';
import type { CursorProviderConfig, LlmProviderAdapter } from '../llm.types';

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

/**
 * Cursor failover provider.
 *
 * - If `CURSOR_BASE_URL` is set → OpenAI-compatible `/chat/completions` (proxy).
 * - Otherwise → `@cursor/sdk` `Agent.prompt` with CURSOR_API_KEY.
 *
 * Cursor Cloud Agents API is not a raw chat API; the SDK path is the official
 * way to call Cursor models with a dashboard API key.
 */
export class CursorProvider implements LlmProviderAdapter {
  readonly name = 'cursor' as const;
  private readonly workspaceDir: string;

  constructor(private readonly config: CursorProviderConfig) {
    this.workspaceDir = join(tmpdir(), 'services-cursor-llm');
    try {
      mkdirSync(this.workspaceDir, { recursive: true });
    } catch {
      // best-effort; Agent.prompt will surface errors if cwd is unusable
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey?.trim());
  }

  getModels(): string[] {
    return [this.config.model, ...this.config.fallbackModels];
  }

  async generate(input: {
    prompt: string;
    model: string;
    responseMimeType?: 'application/json';
  }): Promise<string> {
    if (!this.config.apiKey?.trim()) {
      throw new Error('CURSOR_API_KEY is not configured');
    }

    if (this.config.baseUrl?.trim()) {
      return this.generateViaOpenAiCompatible(input);
    }

    return this.generateViaSdk(input);
  }

  private async generateViaSdk(input: {
    prompt: string;
    model: string;
    responseMimeType?: 'application/json';
  }): Promise<string> {
    const message = this.wrapPrompt(input.prompt, input.responseMimeType);

    const result = await Agent.prompt(message, {
      apiKey: this.config.apiKey,
      model: { id: input.model },
      ...(this.config.runtime === 'cloud'
        ? { cloud: { env: { type: 'cloud' as const } } }
        : {
            local: {
              cwd: this.workspaceDir,
              sandboxOptions: { enabled: true },
            },
          }),
    });

    if (result.status === 'error') {
      throw new Error(
        `Cursor agent run failed (id=${result.id}${
          result.result ? `: ${result.result.slice(0, 200)}` : ''
        })`,
      );
    }

    const text = result.result?.trim();
    if (!text) {
      throw new Error('Cursor agent returned an empty response');
    }

    return this.extractJsonIfNeeded(text, input.responseMimeType);
  }

  private async generateViaOpenAiCompatible(input: {
    prompt: string;
    model: string;
    responseMimeType?: 'application/json';
  }): Promise<string> {
    const baseUrl = this.config.baseUrl!.replace(/\/$/, '');
    const body: Record<string, unknown> = {
      model: input.model,
      messages: [
        {
          role: 'user',
          content: this.wrapPrompt(input.prompt, input.responseMimeType),
        },
      ],
    };

    if (input.responseMimeType === 'application/json') {
      body.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeoutMs = Number(process.env.LLM_REQUEST_TIMEOUT_MS ?? 120_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const raw = await response.text();
      let payload: OpenAiChatResponse = {};
      try {
        payload = raw ? (JSON.parse(raw) as OpenAiChatResponse) : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const apiMessage = payload.error?.message ?? raw.slice(0, 300);
        throw new Error(
          apiMessage
            ? `Cursor ${response.status}: ${apiMessage}`
            : `Cursor request failed with status ${response.status}`,
        );
      }

      const content = payload.choices?.[0]?.message?.content;
      const text = this.normalizeContent(content);
      if (!text) {
        throw new Error('Cursor /chat/completions returned an empty response');
      }

      return this.extractJsonIfNeeded(text, input.responseMimeType);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Cursor request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private wrapPrompt(
    prompt: string,
    responseMimeType?: 'application/json',
  ): string {
    if (responseMimeType !== 'application/json') {
      return [
        'Reply with the answer only. Do not edit files, run commands, or use tools.',
        '',
        prompt,
      ].join('\n');
    }

    return [
      'You are a JSON API. Reply with ONLY valid JSON matching the request.',
      'Do not edit files, run commands, use tools, or wrap the JSON in markdown.',
      '',
      prompt,
    ].join('\n');
  }

  private normalizeContent(
    content: string | Array<{ type?: string; text?: string }> | undefined,
  ): string {
    if (typeof content === 'string') {
      return content.trim();
    }
    if (!Array.isArray(content)) {
      return '';
    }
    return content
      .map((part) => part.text ?? '')
      .join('')
      .trim();
  }

  private extractJsonIfNeeded(
    text: string,
    responseMimeType?: 'application/json',
  ): string {
    if (responseMimeType !== 'application/json') {
      return text;
    }

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]?.trim()) {
      return fenced[1].trim();
    }

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return text.slice(start, end + 1);
    }

    return text;
  }
}
