/** Weekly body-weight change assumptions (kg) — Phase 2 deterministic engine */
export const WEEKLY_FAT_LOSS_KG = 0.5;
export const WEEKLY_MUSCLE_GAIN_KG = 0.25;

export const MILESTONE_WEEKS = [4, 8, 12, 16] as const;

export const TRANSFORMATION_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;
