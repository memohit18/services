import { z } from 'zod';

export const RESUME_PARSE_PROMPT_VERSION = 1;

export const ParsedResumeSkillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  level: z.string().trim().max(40).nullish(),
});

export const ParsedResumeExperienceSchema = z.object({
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  startDate: z.string().trim().max(40).nullish(),
  endDate: z.string().trim().max(40).nullish(),
  description: z.string().trim().max(2000).nullish(),
});

export const ParsedResumeEducationSchema = z.object({
  institution: z.string().trim().min(1).max(160),
  degree: z.string().trim().max(120).nullish(),
  field: z.string().trim().max(120).nullish(),
  startDate: z.string().trim().max(40).nullish(),
  endDate: z.string().trim().max(40).nullish(),
});

export const ParsedResumeSchema = z.object({
  skills: z.array(ParsedResumeSkillSchema).max(100).default([]),
  experience: z.array(ParsedResumeExperienceSchema).max(50).default([]),
  education: z.array(ParsedResumeEducationSchema).max(20).default([]),
});

export type ParsedResumePayload = z.infer<typeof ParsedResumeSchema>;

export function buildResumeParsePrompt(resumeText: string): string {
  const clipped = resumeText.slice(0, 40_000);
  return `You are a resume parsing engine. Extract structured data from the resume text below.

Return ONLY valid JSON matching this shape:
{
  "skills": [{ "name": string, "level": string | null }],
  "experience": [{
    "company": string,
    "role": string,
    "startDate": string | null,
    "endDate": string | null,
    "description": string | null
  }],
  "education": [{
    "institution": string,
    "degree": string | null,
    "field": string | null,
    "startDate": string | null,
    "endDate": string | null
  }]
}

Rules:
- Prefer concise skill names (technologies, tools, languages).
- Keep experience chronological if possible (most recent first).
- Use null when a field is unknown.
- Do not invent employers, degrees, or skills that are not present.

RESUME TEXT:
"""
${clipped}
"""`;
}
