export type CareerJsonStringArray = string[];

export type ParsedResumeSkill = {
  name: string;
  level?: string | null;
};

export type ParsedResumeExperience = {
  company: string;
  role: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
};

export type ParsedResumeEducation = {
  institution: string;
  degree?: string | null;
  field?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type ParsedResumeResult = {
  skills: ParsedResumeSkill[];
  experience: ParsedResumeExperience[];
  education: ParsedResumeEducation[];
};

export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'internship',
  'freelance',
] as const;

export const WORK_MODES = ['remote', 'hybrid', 'onsite'] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type WorkMode = (typeof WORK_MODES)[number];
