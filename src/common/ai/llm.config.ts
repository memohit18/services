import type { ConfigService } from '@nestjs/config';
import {
  DEFAULT_GEMINI_FALLBACK_MODELS,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROK_BASE_URL,
  DEFAULT_GROK_FALLBACK_MODELS,
  DEFAULT_GROK_MODEL,
  DEFAULT_LLM_MAX_RETRIES,
  DEFAULT_LLM_PROVIDER_ORDER,
} from './llm.constants';
import type { LlmConfig, LlmProvider } from './llm.types';

function parseCsv(value: string | undefined): string[] {
  return (
    value
      ?.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean) ?? []
  );
}

function parseProviderOrder(value: string | undefined): LlmProvider[] {
  const parsed = parseCsv(value).filter(
    (entry): entry is LlmProvider => entry === 'gemini' || entry === 'grok',
  );

  return parsed.length > 0 ? parsed : [...DEFAULT_LLM_PROVIDER_ORDER];
}

function uniqueModels(primary: string, fallbacks: string[]): string[] {
  return [primary, ...fallbacks.filter((model) => model !== primary)];
}

/** Groq keys (groq.com) start with gsk_ — not valid for xAI Grok (x.ai). */
export function isGroqApiKey(key: string | undefined): boolean {
  return Boolean(key?.trim().startsWith('gsk_'));
}

export type XaiKeySource = 'XAI_API_KEY' | 'GROK_API_KEY' | null;

/** Prefer XAI_API_KEY; ignore GROK_API_KEY when it holds a Groq key. */
export function resolveXaiApiKey(env: NodeJS.ProcessEnv): {
  apiKey?: string;
  source: XaiKeySource;
} {
  const xaiKey = env.XAI_API_KEY?.trim();
  const grokKey = env.GROK_API_KEY?.trim();

  if (xaiKey) {
    return { apiKey: xaiKey, source: 'XAI_API_KEY' };
  }

  if (grokKey && !isGroqApiKey(grokKey)) {
    return { apiKey: grokKey, source: 'GROK_API_KEY' };
  }

  if (grokKey && isGroqApiKey(grokKey)) {
    return { apiKey: undefined, source: null };
  }

  return { apiKey: undefined, source: null };
}

export function loadLlmConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LlmConfig {
  const geminiModel = env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const geminiFallbacks =
    parseCsv(env.GEMINI_FALLBACK_MODELS).length > 0
      ? parseCsv(env.GEMINI_FALLBACK_MODELS)
      : [...DEFAULT_GEMINI_FALLBACK_MODELS];

  const grokModel = env.GROK_MODEL ?? DEFAULT_GROK_MODEL;
  const grokFallbacks =
    parseCsv(env.GROK_FALLBACK_MODELS).length > 0
      ? parseCsv(env.GROK_FALLBACK_MODELS)
      : [...DEFAULT_GROK_FALLBACK_MODELS];

  const { apiKey: grokApiKey } = resolveXaiApiKey(env);

  return {
    providerOrder: parseProviderOrder(env.LLM_PROVIDER_ORDER),
    maxRetries: Math.max(
      1,
      Number(env.LLM_MAX_RETRIES ?? env.GEMINI_MAX_RETRIES ?? DEFAULT_LLM_MAX_RETRIES),
    ),
    gemini: {
      apiKey: env.GEMINI_API_KEY?.trim(),
      model: geminiModel,
      fallbackModels: uniqueModels(geminiModel, geminiFallbacks).slice(1),
    },
    grok: {
      apiKey: grokApiKey,
      model: grokModel,
      fallbackModels: uniqueModels(grokModel, grokFallbacks).slice(1),
      baseUrl: env.GROK_BASE_URL ?? DEFAULT_GROK_BASE_URL,
    },
  };
}

export function loadLlmConfigFromNestConfig(config: ConfigService): LlmConfig {
  return loadLlmConfigFromEnv({
    GEMINI_API_KEY: config.get<string>('GEMINI_API_KEY'),
    GEMINI_MODEL: config.get<string>('GEMINI_MODEL'),
    GEMINI_FALLBACK_MODELS: config.get<string>('GEMINI_FALLBACK_MODELS'),
    GEMINI_MAX_RETRIES: config.get<string>('GEMINI_MAX_RETRIES'),
    GROK_API_KEY: config.get<string>('GROK_API_KEY'),
    XAI_API_KEY: config.get<string>('XAI_API_KEY'),
    GROK_MODEL: config.get<string>('GROK_MODEL'),
    GROK_FALLBACK_MODELS: config.get<string>('GROK_FALLBACK_MODELS'),
    GROK_BASE_URL: config.get<string>('GROK_BASE_URL'),
    LLM_PROVIDER_ORDER: config.get<string>('LLM_PROVIDER_ORDER'),
    LLM_MAX_RETRIES: config.get<string>('LLM_MAX_RETRIES'),
  });
}
