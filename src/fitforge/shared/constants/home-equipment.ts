/**
 * Home workout equipment options for fitness profile (`equipmentAvailable` JSON).
 * Kept in-repo so builds survive `git submodule update` (db-schema may lag).
 */
export const HOME_EQUIPMENT_OPTIONS = [
  'dumbbells',
  'resistance_bands',
  'pull_up_bar',
  'kettlebell',
  'bench',
  'barbell',
  'yoga_mat',
] as const;

export type HomeEquipment = (typeof HOME_EQUIPMENT_OPTIONS)[number];
