export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';

export const DEFAULT_GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
] as const;

export const DEFAULT_GROK_MODEL = 'grok-4.3';

export const DEFAULT_GROK_FALLBACK_MODELS = ['grok-3-mini', 'grok-3'] as const;

export const DEFAULT_GROK_BASE_URL = 'https://api.x.ai/v1';

/** Cursor SDK agent model (not a raw chat-completions API). */
export const DEFAULT_CURSOR_MODEL = 'composer-2';

export const DEFAULT_CURSOR_FALLBACK_MODELS = ['auto'] as const;

/**
 * Optional OpenAI-compatible proxy base (e.g. local cursor-api-proxy).
 * When unset, the Cursor provider uses @cursor/sdk Agent.prompt instead.
 */
export const DEFAULT_CURSOR_BASE_URL = '';

export const DEFAULT_LLM_PROVIDER_ORDER = [
  'gemini',
  'grok',
  'cursor',
] as const;

export const DEFAULT_LLM_MAX_RETRIES = 3;
