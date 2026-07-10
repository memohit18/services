export const DIET_AI_PROVIDER = Symbol('DIET_AI_PROVIDER');

export interface DietAiProvider {
  readonly name: string;
  generateDiet(prompt: string): Promise<unknown>;
}
