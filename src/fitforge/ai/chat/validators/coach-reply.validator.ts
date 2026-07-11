export type CoachReplyValidationResult = {
  valid: boolean;
  content: string;
  warnings: string[];
};

const EMPTY_FALLBACK =
  "I'm having trouble generating a response right now. Please try again in a moment.";

/**
 * Validator — post-processes Gemini text. AI never touches the DB.
 */
export function validateCoachReply(
  raw: string | null | undefined,
): CoachReplyValidationResult {
  const warnings: string[] = [];
  let content = (raw ?? '').trim();

  if (!content) {
    return { valid: false, content: EMPTY_FALLBACK, warnings: ['empty_reply'] };
  }

  // Strip accidental markdown code fences around the whole reply
  const fenced = content.match(/^```(?:\w+)?\s*([\s\S]*?)```$/);
  if (fenced) {
    content = fenced[1].trim();
    warnings.push('stripped_code_fence');
  }

  // Soft-clamp extremely long replies for mobile UX
  const maxChars = 4000;
  if (content.length > maxChars) {
    content = `${content.slice(0, maxChars).trimEnd()}…`;
    warnings.push('truncated');
  }

  // Reject replies that look like leaked system/tool JSON
  if (
    (content.startsWith('{') && content.endsWith('}')) ||
    (content.startsWith('[') && content.endsWith(']'))
  ) {
    try {
      JSON.parse(content);
      return {
        valid: false,
        content:
          'I generated an invalid format. Please ask again and I will reply in plain language.',
        warnings: ['json_payload'],
      };
    } catch {
      // not valid JSON — keep as text
    }
  }

  return { valid: warnings.length === 0, content, warnings };
}

export class CoachReplyValidator {
  validate(raw: string | null | undefined): CoachReplyValidationResult {
    return validateCoachReply(raw);
  }
}
