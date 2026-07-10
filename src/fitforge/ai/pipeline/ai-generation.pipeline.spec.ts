import { BadRequestException } from '@nestjs/common';
import { AiGenerationPipeline } from './ai-generation.pipeline';
import type { GeminiService } from '../gemini/gemini.service';

describe('AiGenerationPipeline', () => {
  const gemini = {
    generateJson: jest.fn(),
    getLastUsedProvider: jest.fn().mockReturnValue('gemini'),
    getLastUsedModel: jest.fn().mockReturnValue('gemini-2.5-flash-lite'),
  } as unknown as GeminiService;

  const pipeline = new AiGenerationPipeline(gemini);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs context → prompt → llm → validate → normalize → save', async () => {
    const order: string[] = [];
    (gemini.generateJson as jest.Mock).mockImplementation(async () => {
      order.push('llm');
      return { value: 10 };
    });

    const result = await pipeline.runJson({
      promptVersion: 1,
      collectContext: async () => {
        order.push('context');
        return { userId: 'u1' };
      },
      buildPrompt: (ctx) => {
        order.push('prompt');
        return `prompt for ${ctx.userId}`;
      },
      validate: (raw) => {
        order.push('validate');
        return raw as { value: number };
      },
      normalize: (raw) => {
        order.push('normalize');
        return { value: raw.value * 2 };
      },
      save: async (normalized) => {
        order.push('save');
        return { saved: normalized.value };
      },
    });

    expect(order).toEqual([
      'context',
      'prompt',
      'llm',
      'validate',
      'normalize',
      'save',
    ]);
    expect(result.data).toEqual({ saved: 20 });
    expect(result.metadata.provider).toBe('gemini');
    expect(gemini.generateJson).toHaveBeenCalledWith('prompt for u1');
  });

  it('does not save when validation fails', async () => {
    (gemini.generateJson as jest.Mock).mockResolvedValue({ bad: true });
    const save = jest.fn();

    await expect(
      pipeline.runJson({
        collectContext: async () => ({}),
        buildPrompt: () => 'p',
        validate: () => {
          throw new BadRequestException('invalid');
        },
        normalize: (raw) => raw,
        save,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(save).not.toHaveBeenCalled();
  });
});
