/**
 * Shared AI generation pipeline contract.
 *
 * Flow (never skip validation/normalize before DB write):
 *   Collect Context → Prompt Builder → LLM → Structured JSON
 *   → Validate → Normalize → Save
 */
export type AiJsonPipelineSteps<TContext, TRaw, TNormalized, TSaved> = {
  /** Load user/profile/engine inputs needed for the prompt and save. */
  collectContext: () => Promise<TContext>;

  /** Build the LLM prompt from collected context. */
  buildPrompt: (context: TContext) => string | Promise<string>;

  /**
   * Validate raw LLM JSON shape/types.
   * Must throw (e.g. BadRequestException) on invalid payloads.
   */
  validate: (raw: unknown) => TRaw;

  /**
   * Map validated AI output into domain-ready data
   * (clamp numbers, resolve entities, fill defaults).
   */
  normalize: (
    raw: TRaw,
    context: TContext,
  ) => TNormalized | Promise<TNormalized>;

  /** Persist only after validate + normalize succeed. */
  save: (
    normalized: TNormalized,
    context: TContext,
  ) => Promise<TSaved>;

  /** Optional prompt version for aiMetadata. */
  promptVersion?: number;
};

export type AiJsonPipelineResult<TSaved> = {
  data: TSaved;
  metadata: {
    provider: string;
    model: string;
    promptVersion: number | null;
  };
};
