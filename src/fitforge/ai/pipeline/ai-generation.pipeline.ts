import { BadRequestException, Injectable } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import type {
  AiJsonPipelineResult,
  AiJsonPipelineSteps,
} from './ai-pipeline.types';

/**
 * Generic structured-JSON AI pipeline.
 *
 * Enforces: context → prompt → LLM → validate → normalize → save.
 * Feature services supply the steps; they must not call the LLM and write DB directly.
 */
@Injectable()
export class AiGenerationPipeline {
  constructor(private readonly gemini: GeminiService) {}

  async runJson<TContext, TRaw, TNormalized, TSaved>(
    steps: AiJsonPipelineSteps<TContext, TRaw, TNormalized, TSaved>,
  ): Promise<AiJsonPipelineResult<TSaved>> {
    const context = await steps.collectContext();
    const prompt = await steps.buildPrompt(context);
    const raw = await this.gemini.generateJson<unknown>(prompt);

    let validated: TRaw;
    try {
      validated = steps.validate(raw);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error
          ? `AI response validation failed: ${error.message}`
          : 'AI response validation failed',
      );
    }

    const normalized = await steps.normalize(validated, context);
    const data = await steps.save(normalized, context);

    return {
      data,
      metadata: {
        provider: this.gemini.getLastUsedProvider() ?? 'unknown',
        model: this.gemini.getLastUsedModel(),
        promptVersion: steps.promptVersion ?? null,
      },
    };
  }
}
