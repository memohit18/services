import { Injectable } from '@nestjs/common';
import type {
  AiMessage,
  DailyCheckin,
  DietPlan,
  ProgressLog,
  User,
  UserFitnessProfile,
  UserFoodPreference,
  WorkoutPlan,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const workoutPlanInclude = {
  days: {
    orderBy: { dayNumber: 'asc' as const },
    include: {
      exercises: {
        include: { exercise: true },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
};

export type WorkoutPlanWithDays = WorkoutPlan & {
  days: Array<{
    dayNumber: number;
    title: string;
    exercises: Array<{
      sets: number;
      reps: string;
      restSeconds: number;
      exercise: { name: string };
    }>;
  }>;
};

export type CoachContext = {
  user: Pick<User, 'name'>;
  profile: UserFitnessProfile | null;
  activeDiet: DietPlan | null;
  activeWorkout: WorkoutPlanWithDays | null;
  latestProgress: ProgressLog | null;
  recentProgress: ProgressLog[];
  latestCheckin: DailyCheckin | null;
  recentCheckins: DailyCheckin[];
  foodPreferences: UserFoodPreference[];
};

@Injectable()
export class AiContextService {
  constructor(private readonly prisma: PrismaService) {}

  async buildCoachContext(userId: string): Promise<CoachContext> {
    const [
      user,
      profile,
      activeDiet,
      activeWorkout,
      latestProgress,
      recentProgress,
      latestCheckin,
      recentCheckins,
      foodPreferences,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
      this.prisma.userFitnessProfile.findUnique({ where: { userId } }),
      this.prisma.dietPlan.findFirst({
        where: { userId, status: 'active' },
        orderBy: { version: 'desc' },
      }),
      this.prisma.workoutPlan.findFirst({
        where: { userId, status: 'active' },
        orderBy: { version: 'desc' },
        include: workoutPlanInclude,
      }),
      this.prisma.progressLog.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.progressLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 14,
      }),
      this.prisma.dailyCheckin.findFirst({
        where: { userId },
        orderBy: { checkInDate: 'desc' },
      }),
      this.prisma.dailyCheckin.findMany({
        where: { userId },
        orderBy: { checkInDate: 'desc' },
        take: 14,
      }),
      this.prisma.userFoodPreference.findMany({ where: { userId } }),
    ]);

    return {
      user: user ?? { name: 'User' },
      profile,
      activeDiet,
      activeWorkout: activeWorkout as WorkoutPlanWithDays | null,
      latestProgress,
      recentProgress,
      latestCheckin,
      recentCheckins,
      foodPreferences,
    };
  }

  formatHistory(messages: AiMessage[]): string {
    if (messages.length === 0) {
      return 'No prior messages.';
    }
    return messages
      .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n');
  }

  formatDietSummary(diet: DietPlan | null): string {
    if (!diet) {
      return 'No active diet plan.';
    }
    return [
      `Goal: ${diet.goal ?? 'n/a'}`,
      `Calories: ${diet.caloriesTarget ?? 'n/a'}`,
      `Protein: ${diet.proteinTarget ?? 'n/a'}g`,
      `Carbs: ${diet.carbsTarget ?? 'n/a'}g`,
      `Fats: ${diet.fatsTarget ?? 'n/a'}g`,
    ].join(', ');
  }

  formatWorkoutSummary(workout: WorkoutPlanWithDays | null): string {
    if (!workout) {
      return 'No active workout plan.';
    }
    const dayLines = workout.days.map((day) => {
      const exercises = day.exercises
        .map((e) => `${e.exercise.name} (${e.sets}x${e.reps})`)
        .join(', ');
      return `Day ${day.dayNumber} ${day.title}: ${exercises || 'rest'}`;
    });
    return [`Goal: ${workout.goal ?? 'n/a'}`, `Days/week: ${workout.daysPerWeek ?? workout.days.length}`, ...dayLines].join('\n');
  }

  formatProgressSummary(ctx: CoachContext): string {
    const lines: string[] = [];
    if (ctx.latestProgress?.weightKg != null) {
      lines.push(`Latest weight: ${ctx.latestProgress.weightKg} kg`);
    }
    if (ctx.recentProgress.length >= 2) {
      const newest = ctx.recentProgress[0].weightKg;
      const oldest = ctx.recentProgress[ctx.recentProgress.length - 1].weightKg;
      if (newest != null && oldest != null) {
        const delta = Math.round((newest - oldest) * 10) / 10;
        lines.push(`Weight change (last ${ctx.recentProgress.length} logs): ${delta > 0 ? '+' : ''}${delta} kg`);
      }
    }
    if (ctx.latestCheckin) {
      lines.push(
        `Latest check-in compliance: ${ctx.latestCheckin.dietCompliance ?? 'n/a'}%`,
        `Meals completed: ${ctx.latestCheckin.mealsCompleted}, skipped: ${ctx.latestCheckin.mealsSkipped}`,
        `Workout completed: ${ctx.latestCheckin.workoutCompleted ? 'yes' : 'no'}`,
      );
    }
    const missedWorkouts = ctx.recentCheckins.filter((c) => !c.workoutCompleted).length;
    if (ctx.recentCheckins.length > 0) {
      lines.push(`Workouts skipped (last ${ctx.recentCheckins.length} days): ${missedWorkouts}`);
    }
    const avgCompliance =
      ctx.recentCheckins.length > 0
        ? Math.round(
            ctx.recentCheckins.reduce((sum, c) => sum + (c.dietCompliance ?? 0), 0) /
              ctx.recentCheckins.length,
          )
        : null;
    if (avgCompliance != null) {
      lines.push(`Average meal compliance (14d): ${avgCompliance}%`);
    }
    return lines.length > 0 ? lines.join('\n') : 'No progress logs yet.';
  }

  buildCoachPrompt(
    ctx: CoachContext,
    history: AiMessage[],
    userMessage: string,
  ): string {
    const profile = ctx.profile;
    const allergies = ctx.foodPreferences
      .filter((p) => p.preferenceType === 'allergy')
      .length;
    const restricted = ctx.foodPreferences
      .filter((p) => p.preferenceType === 'restricted')
      .length;

    return `You are FitForge AI Coach — a knowledgeable, supportive personal trainer and nutrition coach.

User Profile:
Name: ${ctx.user.name}
${profile ? `Age: ${profile.age}
Gender: ${profile.gender}
Weight: ${profile.weightKg} kg
Height: ${profile.heightCm} cm
Goal: ${profile.fitnessGoal}
Diet Type: ${profile.dietType}
Activity: ${profile.activityLevel}
Experience: ${profile.experienceLevel ?? 'n/a'}
Budget: ${profile.budgetPreference}` : 'No fitness profile on file.'}

Food Preferences:
Allergies flagged: ${allergies}
Restricted foods: ${restricted}

Current Diet Targets:
${this.formatDietSummary(ctx.activeDiet)}

Current Workout:
${this.formatWorkoutSummary(ctx.activeWorkout)}

Progress & Accountability:
${this.formatProgressSummary(ctx)}

Conversation History:
${this.formatHistory(history)}

Current User Message:
${userMessage}

Instructions:
- Be concise and actionable.
- Reference the user's actual progress data when relevant.
- Suggest meal swaps from their diet type when they dislike a food.
- Do not invent medical diagnoses.`;
  }
}
