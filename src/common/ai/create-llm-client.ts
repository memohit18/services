import { LlmClient } from './llm.client';
import type { LlmLogger } from './llm.types';

export function createLlmClientFromEnv(logger?: LlmLogger): LlmClient {
  return LlmClient.fromEnv(logger);
}

export { LlmClient };
