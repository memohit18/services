import { validateCoachReply } from './coach-reply.validator';

describe('validateCoachReply', () => {
  it('returns fallback for empty replies', () => {
    const result = validateCoachReply('   ');
    expect(result.valid).toBe(false);
    expect(result.content).toContain('trouble generating');
    expect(result.warnings).toContain('empty_reply');
  });

  it('strips wrapping code fences', () => {
    const result = validateCoachReply('```\nEat eggs and toast.\n```');
    expect(result.content).toBe('Eat eggs and toast.');
    expect(result.warnings).toContain('stripped_code_fence');
  });

  it('rejects pure JSON payloads', () => {
    const result = validateCoachReply('{"meal":"chicken"}');
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('json_payload');
  });

  it('accepts normal coaching text', () => {
    const result = validateCoachReply(
      'You skipped lunch — try a high-protein snack within your remaining calories.',
    );
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
