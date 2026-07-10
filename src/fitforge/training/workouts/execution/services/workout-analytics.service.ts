import { Injectable } from '@nestjs/common';
import type { WorkoutLog } from '@prisma/client';
import {
  computeWorkoutSessionAnalytics,
  effectiveDurationMinutes,
} from '../analytics/workout-session-analytics.engine';

type SessionWithLogs = {
  createdAt: Date;
  completedAt: Date | null;
  totalPausedSeconds: number;
  caloriesBurned: number | null;
  durationMinutes: number | null;
  workoutPlanDay: {
    exercises: Array<{ id: string; sets: number; restSeconds: number }>;
  } | null;
  exerciseLogs: Array<
    Pick<
      WorkoutLog,
      | 'workoutPlanExerciseId'
      | 'setNumber'
      | 'completedReps'
      | 'completedWeight'
      | 'restSeconds'
      | 'status'
      | 'durationMinutes'
    >
  >;
};

@Injectable()
export class WorkoutAnalyticsService {
  fromSession(session: SessionWithLogs) {
    const { completedIds, skippedIds } = this.exerciseOutcomes(
      session.exerciseLogs,
    );
    const duration =
      session.durationMinutes ??
      effectiveDurationMinutes(
        session.createdAt,
        session.completedAt,
        session.totalPausedSeconds ?? 0,
      );

    return computeWorkoutSessionAnalytics({
      plannedExercises: (session.workoutPlanDay?.exercises ?? []).map((e) => ({
        id: e.id,
        sets: e.sets,
        restSeconds: e.restSeconds,
      })),
      logs: session.exerciseLogs.map((l) => ({
        setNumber: l.setNumber,
        completedReps: l.completedReps,
        completedWeight: l.completedWeight,
        restSeconds: l.restSeconds,
        status: l.status,
        durationMinutes: l.durationMinutes,
      })),
      durationMinutes: duration,
      caloriesBurned: session.caloriesBurned,
      completedExerciseIds: [...completedIds],
      skippedExerciseIds: [...skippedIds],
    });
  }

  exerciseOutcomes(
    logs: Array<
      Pick<WorkoutLog, 'workoutPlanExerciseId' | 'setNumber' | 'status'>
    >,
  ) {
    const completedIds = new Set<string>();
    const skippedIds = new Set<string>();
    for (const log of logs) {
      if (log.setNumber != null) {
        continue;
      }
      if (log.status === 'completed') {
        completedIds.add(log.workoutPlanExerciseId);
      }
      if (log.status === 'skipped') {
        skippedIds.add(log.workoutPlanExerciseId);
      }
    }
    return { completedIds, skippedIds };
  }

  effectiveDuration(
    createdAt: Date,
    completedAt: Date | null,
    totalPausedSeconds: number,
  ) {
    return effectiveDurationMinutes(createdAt, completedAt, totalPausedSeconds);
  }
}
