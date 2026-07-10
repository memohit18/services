import { computeWorkoutSessionAnalytics } from './workout-session-analytics.engine';

describe('computeWorkoutSessionAnalytics', () => {
  it('computes volume, sets, and completion %', () => {
    const result = computeWorkoutSessionAnalytics({
      plannedExercises: [
        { id: 'e1', sets: 3, restSeconds: 60 },
        { id: 'e2', sets: 3, restSeconds: 90 },
      ],
      logs: [
        {
          setNumber: 1,
          completedReps: '10',
          completedWeight: 60,
          restSeconds: 60,
          status: 'completed',
          durationMinutes: null,
        },
        {
          setNumber: 2,
          completedReps: '8',
          completedWeight: 60,
          restSeconds: 60,
          status: 'completed',
          durationMinutes: null,
        },
      ],
      durationMinutes: 40,
      caloriesBurned: 280,
      completedExerciseIds: ['e1'],
      skippedExerciseIds: ['e2'],
    });

    expect(result.workoutVolume).toBe(1080); // 10*60 + 8*60
    expect(result.setsCompleted).toBe(2);
    expect(result.setsPlanned).toBe(6);
    expect(result.exercisesCompleted).toBe(1);
    expect(result.skippedExercises).toBe(1);
    expect(result.completionPercent).toBe(100);
    expect(result.caloriesBurned).toBe(280);
  });
});
