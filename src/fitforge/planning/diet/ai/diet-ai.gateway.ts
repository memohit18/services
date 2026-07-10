import { Inject, Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../../../ai/gemini/gemini.service';
import {
  DIET_AI_PROVIDER,
  type DietAiProvider,
} from './diet-ai.provider';
import {
  DietResponseValidator,
  type DietValidationContext,
} from './diet-response.validator';
import type { AiDietResponse } from './diet-response.schema';
import { DIET_AI_PROMPT_VERSION } from './diet-response.schema';

export type DietAiGatewayResult = {
  response: AiDietResponse;
  metadata: {
    provider: string;
    model: string;
    promptVersion: number;
    attempts: number;
  };
};

/**
 * AI Gateway — controllers never call providers directly.
 * Flow: prompt → provider → validate (retry once) → return structured result.
 */
@Injectable()
export class DietAiGateway {
  private readonly logger = new Logger(DietAiGateway.name);

  constructor(
    @Inject(DIET_AI_PROVIDER) private readonly provider: DietAiProvider,
    private readonly validator: DietResponseValidator,
    private readonly gemini: GeminiService,
  ) {}

  async generateDiet(
    prompt: string,
    validationCtx: DietValidationContext,
  ): Promise<DietAiGatewayResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await this.provider.generateDiet(prompt);
        const response = this.validator.validate(raw, validationCtx);
        return {
          response,
          metadata: {
            provider: this.gemini.getLastUsedProvider() ?? this.provider.name,
            model: this.gemini.getLastUsedModel(),
            promptVersion: DIET_AI_PROMPT_VERSION,
            attempts: attempt,
          },
        };
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Diet AI attempt ${attempt} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (attempt === 2) {
          break;
        }
      }
    }

    throw lastError;
  }
}
