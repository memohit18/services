import type { CareerProfile } from '@prisma/client';

export type CareerProfileView = {
  id: string;
  userId: string;
  currentCompany: string | null;
  currentRole: string | null;
  totalExperience: number;
  currentCtc: number | null;
  expectedMinCtc: number | null;
  expectedMaxCtc: number | null;
  noticePeriod: number | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  summary: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toCareerProfileView(profile: CareerProfile): CareerProfileView {
  return {
    id: profile.id,
    userId: profile.userId,
    currentCompany: profile.currentCompany,
    currentRole: profile.currentRole,
    totalExperience: profile.totalExperience,
    currentCtc: profile.currentCtc,
    expectedMinCtc: profile.expectedMinCtc,
    expectedMaxCtc: profile.expectedMaxCtc,
    noticePeriod: profile.noticePeriod,
    linkedinUrl: profile.linkedinUrl,
    githubUrl: profile.githubUrl,
    portfolioUrl: profile.portfolioUrl,
    summary: profile.summary,
    isActive: profile.isActive,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}
