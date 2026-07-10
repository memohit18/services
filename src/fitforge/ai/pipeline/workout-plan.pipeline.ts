import { BadRequestException } from '@nestjs/common';
import {
  assertNonEmptyArray,
  assertNumber,
  assertObject,
  assertString,
  optionalString,
} from './json-assert';

export type AiWorkoutExercise = {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
};

export type AiWorkoutDay = {
  dayNumber: number;
  title: string;
  exercises: AiWorkoutExercise[];
};

export type AiWorkoutPlanResponse = {
  goal?: string;
  daysPerWeek?: number;
  days: AiWorkoutDay[];
};

export type NormalizedWorkoutExercise = {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
};

export type NormalizedWorkoutDay = {
  dayNumber: number;
  title: string;
  exercises: NormalizedWorkoutExercise[];
};

export type NormalizedWorkoutPlan = {
  goal?: string;
  daysPerWeek: number;
  days: NormalizedWorkoutDay[];
};

export function validateWorkoutPlanResponse(raw: unknown): AiWorkoutPlanResponse {
  const obj = assertObject(raw, 'Workout plan response');
  const daysRaw = assertNonEmptyArray(obj.days, 'days');

  const days: AiWorkoutDay[] = daysRaw.map((dayRaw, index) => {
    const day = assertObject(dayRaw, `days[${index}]`);
    const exercisesRaw = assertNonEmptyArray(
      day.exercises,
      `days[${index}].exercises`,
    );

    return {
      dayNumber: assertNumber(day.dayNumber, `days[${index}].dayNumber`, {
        min: 1,
        integer: true,
      }),
      title: assertString(day.title, `days[${index}].title`, { minLength: 1 }),
      exercises: exercisesRaw.map((exRaw, exIndex) => {
        const ex = assertObject(exRaw, `days[${index}].exercises[${exIndex}]`);
        const reps =
          typeof ex.reps === 'number'
            ? String(ex.reps)
            : assertString(ex.reps, `exercises[${exIndex}].reps`, {
                minLength: 1,
              });

        return {
          name: assertString(ex.name, `exercises[${exIndex}].name`, {
            minLength: 1,
          }),
          sets: assertNumber(ex.sets, `exercises[${exIndex}].sets`, {
            min: 1,
            max: 20,
            integer: true,
          }),
          reps,
          restSeconds: assertNumber(
            ex.restSeconds,
            `exercises[${exIndex}].restSeconds`,
            { min: 0, max: 600, integer: true },
          ),
        };
      }),
    };
  });

  return {
    goal: optionalString(obj.goal),
    daysPerWeek:
      obj.daysPerWeek === undefined
        ? undefined
        : assertNumber(obj.daysPerWeek, 'daysPerWeek', {
            min: 1,
            max: 7,
            integer: true,
          }),
    days,
  };
}

export function normalizeWorkoutPlan(
  raw: AiWorkoutPlanResponse,
  fallbackDaysPerWeek: number,
  fallbackGoal: string,
): NormalizedWorkoutPlan {
  if (!raw.days.length) {
    throw new BadRequestException('AI returned no workout days');
  }

  return {
    goal: raw.goal ?? fallbackGoal,
    daysPerWeek: raw.daysPerWeek ?? fallbackDaysPerWeek,
    days: raw.days.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title.trim(),
      exercises: day.exercises.map((ex) => ({
        name: ex.name.trim(),
        sets: ex.sets,
        reps: String(ex.reps).trim(),
        restSeconds: ex.restSeconds,
      })),
    })),
  };
}

export type WorkoutPlanPromptInput = {
  daysPerWeek: number;
  fitnessGoal: string;
  experienceLevel: string;
  workoutMode: string;
  exerciseNames: string[];
};

export function buildWorkoutPlanPrompt(input: WorkoutPlanPromptInput): string {
  return `Generate a ${input.daysPerWeek}-day workout plan. Return JSON only.

User:
Goal: ${input.fitnessGoal}
Experience: ${input.experienceLevel}
Workout mode: ${input.workoutMode}
Days per week: ${input.daysPerWeek}

Available exercises (prefer these names):
${input.exerciseNames.join(', ')}

Return format:
{
  "goal": "${input.fitnessGoal}",
  "daysPerWeek": ${input.daysPerWeek},
  "days": [
    {
      "dayNumber": 1,
      "title": "Push Day",
      "exercises": [
        { "name": "Bench Press", "sets": 4, "reps": "8-12", "restSeconds": 90 }
      ]
    }
  ]
}`;
}
