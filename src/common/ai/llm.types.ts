export type LlmProvider = 'gemini' | 'grok' | 'cursor';

export type LlmGenerateOptions = {
  prompt: string;
  responseMimeType?: 'application/json';
};

export type LlmMetadata = {
  provider: LlmProvider;
  model: string;
  promptVersion: number;
};

export type LlmGenerateResult = {
  text: string;
  provider: LlmProvider;
  model: string;
};

export type LlmProviderConfig = {
  apiKey?: string;
  model: string;
  fallbackModels: string[];
};

export type GrokProviderConfig = LlmProviderConfig & {
  baseUrl: string;
};

export type CursorProviderConfig = LlmProviderConfig & {
  /** When set, use OpenAI-compatible POST {baseUrl}/chat/completions */
  baseUrl?: string;
  /** local = Agent.prompt against temp cwd; cloud = Cursor cloud agent */
  runtime: 'local' | 'cloud';
};

export type LlmConfig = {
  providerOrder: LlmProvider[];
  maxRetries: number;
  gemini: LlmProviderConfig;
  grok: GrokProviderConfig;
  cursor: CursorProviderConfig;
};

export type LlmLogLevel = 'warn' | 'error';

export type LlmLogger = (
  level: LlmLogLevel,
  message: string,
  context?: unknown,
) => void;

export interface LlmProviderAdapter {
  readonly name: LlmProvider;
  isConfigured(): boolean;
  getModels(): string[];
  generate(input: {
    prompt: string;
    model: string;
    responseMimeType?: 'application/json';
  }): Promise<string>;
}
