import {
  computeDayScore,
  SCORE_WEIGHTS,
  WATER_TARGET_ML,
} from './score.engine';

describe('computeDayScore', () => {
  it('weights meals/workout/calories/protein/water per Phase 8.2 formula', () => {
    const result = computeDayScore({
      mealsCompleted: 3,
      mealsAssigned: 3,
      workoutCompleted: true,
      caloriesConsumed: 2200,
      calorieTarget: 2200,
      proteinConsumed: 150,
      proteinTarget: 150,
      waterMl: 4000,
    });

    expect(result.breakdown).toEqual({
      meals: 100,
      workout: 100,
      calories: 100,
      protein: 100,
      water: 100,
    });
    expect(result.todayScore).toBe(100);
    expect(result.remainingCalories).toBe(0);
    expect(result.remainingProtein).toBe(0);
    expect(result.weights).toEqual(SCORE_WEIGHTS);
    expect(result.waterTargetMl).toBe(WATER_TARGET_ML);
  });

  it('applies partial component scores', () => {
    // meals 50, workout 0, cal 50, protein 50, water 50
    // 50*0.3 + 0*0.3 + 50*0.15 + 50*0.15 + 50*0.1 = 15+0+7.5+7.5+5 = 35
    const result = computeDayScore({
      mealsCompleted: 1,
      mealsAssigned: 2,
      workoutCompleted: false,
      caloriesConsumed: 1100,
      calorieTarget: 2200,
      proteinConsumed: 75,
      proteinTarget: 150,
      waterMl: 2000,
    });

    expect(result.breakdown.meals).toBe(50);
    expect(result.breakdown.workout).toBe(0);
    expect(result.breakdown.calories).toBe(50);
    expect(result.breakdown.protein).toBe(50);
    expect(result.breakdown.water).toBe(50);
    expect(result.todayScore).toBe(35);
    expect(result.remainingCalories).toBe(1100);
    expect(result.remainingProtein).toBe(75);
  });

  it('returns zero component scores when targets are missing', () => {
    const result = computeDayScore({
      mealsCompleted: 0,
      mealsAssigned: 0,
      workoutCompleted: false,
      caloriesConsumed: 500,
      calorieTarget: 0,
      proteinConsumed: 40,
      proteinTarget: 0,
      waterMl: 0,
    });
    expect(result.todayScore).toBe(0);
    expect(result.breakdown.calories).toBe(0);
    expect(result.breakdown.protein).toBe(0);
  });
});
