import { Injectable } from '@nestjs/common';
import type { AiMessage, DietPlan } from '@prisma/client';
import type {
  CoachContext,
  WorkoutPlanWithDays,
  WorkoutProgressSnapshot,
} from './ai-context.builder';

/**
 * PromptBuilder — turns Context Builder output into the LLM prompt.
 * Never touches the database.
 */
@Injectable()
export class PromptBuilder {
  build(ctx: CoachContext, history: AiMessage[], userMessage: string): string {
    return `You are FitForge AI Coach — a knowledgeable, supportive personal trainer and nutrition coach.
Context version: ${ctx.contextVersion}

User Profile:
Name: ${ctx.user.name}
${
  ctx.profile
    ? `Age: ${ctx.profile.age}
Gender: ${ctx.profile.gender}
Weight: ${ctx.profile.weightKg} kg
Height: ${ctx.profile.heightCm} cm
Goal: ${ctx.profile.fitnessGoal}
Diet Type: ${ctx.profile.dietType}
Activity: ${ctx.profile.activityLevel}
Experience: ${ctx.profile.experienceLevel ?? 'n/a'}
Budget: ${ctx.profile.budgetPreference}`
    : 'No fitness profile on file.'
}

Transformation:
${
  ctx.transformation
    ? `Current weight: ${ctx.transformation.currentWeightKg ?? 'n/a'} kg → Target: ${ctx.transformation.targetWeightKg ?? 'n/a'} kg (${ctx.transformation.estimatedWeeks ?? '?'} weeks)
Calories target: ${ctx.transformation.dailyCalorieTarget ?? 'n/a'}
Protein target: ${ctx.transformation.proteinTarget ?? 'n/a'}g`
    : 'No active transformation plan.'
}

Nutrition Preferences:
${
  ctx.nutritionPreference
    ? `Meals/day: ${ctx.nutritionPreference.mealsPerDay ?? 'n/a'}, Cuisine: ${ctx.nutritionPreference.preferredCuisine ?? 'n/a'}, Cooking time: ${ctx.nutritionPreference.cookingTimeMinutes ?? 'n/a'} min, Budget: ${ctx.nutritionPreference.budgetCategory ?? 'n/a'}`
    : 'No nutrition preferences set.'
}

Food Preferences:
Allergies flagged: ${ctx.foodPreferences.filter((p) => p.preferenceType === 'allergy').length}
Restricted foods: ${ctx.foodPreferences.filter((p) => p.preferenceType === 'restricted').length}

Current Diet Targets:
${this.formatDietSummary(ctx.activeDiet)}

Today's Meals:
${this.formatTodayMeals(ctx)}

Today's Hydration: ${ctx.todayWaterMl} ml (target ${ctx.dayScore?.waterTargetMl ?? 4000} ml)

Workout Progress Today:
${this.formatWorkoutProgress(ctx.workoutProgress)}

Current Workout Plan:
${this.formatWorkoutSummary(ctx.activeWorkout)}

Progress Logs:
${this.formatProgressSummary(ctx)}

Compliance:
Overall score: ${ctx.compliancePercent ?? 'n/a'}%
Breakdown: meals ${ctx.dayScore?.breakdown.meals ?? 'n/a'}%, workout ${ctx.dayScore?.breakdown.workout ?? 'n/a'}%, calories ${ctx.dayScore?.breakdown.calories ?? 'n/a'}%, protein ${ctx.dayScore?.breakdown.protein ?? 'n/a'}%, water ${ctx.dayScore?.breakdown.water ?? 'n/a'}%
Remaining today: ${ctx.dayScore?.remainingCalories ?? 'n/a'} kcal, ${ctx.dayScore?.remainingProtein ?? 'n/a'}g protein

Current Streak:
${
  ctx.streak
    ? `Current: ${ctx.streak.currentStreak} day(s), Longest: ${ctx.streak.longestStreak}, Compliant today: ${ctx.streak.compliantToday ? 'yes' : 'no'}`
    : 'No streak data.'
}

Conversation History:
${this.formatHistory(history)}

Current User Message:
${userMessage}

Instructions:
- Be concise and actionable.
- Reference today's meals, water, compliance, streak, and workout progress when relevant.
- If the user skipped a meal, suggest a recovery meal/snack within remaining calories and protein.
- Suggest meal swaps matching their diet type when they dislike a food.
- Do not invent medical diagnoses.
- Do not claim access to data beyond this context.
- Reply in plain language (no JSON).`;
  }

  /** Alias used by legacy AiCoachService */
  buildCoachPrompt(
    ctx: CoachContext,
    history: AiMessage[],
    userMessage: string,
  ): string {
    return this.build(ctx, history, userMessage);
  }

  formatHistory(messages: AiMessage[]): string {
    if (messages.length === 0) {
      return 'No prior messages.';
    }
    return messages
      .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n');
  }

  private formatDietSummary(diet: DietPlan | null): string {
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

  private formatWorkoutSummary(workout: WorkoutPlanWithDays | null): string {
    if (!workout) {
      return 'No active workout plan.';
    }
    const dayLines = workout.days.map((day) => {
      const exercises = day.exercises
        .map((e) => `${e.exercise.name} (${e.sets}x${e.reps})`)
        .join(', ');
      return `Day ${day.dayNumber} ${day.title}: ${exercises || 'rest'}`;
    });
    return [
      `Goal: ${workout.goal ?? 'n/a'}`,
      `Days/week: ${workout.daysPerWeek ?? workout.days.length}`,
      ...dayLines,
    ].join('\n');
  }

  private formatWorkoutProgress(progress: WorkoutProgressSnapshot): string {
    if (!progress.sessionId && !progress.workoutCompletedToday) {
      return 'No workout session started today.';
    }
    return [
      `Session: ${progress.sessionId ?? 'n/a'} (${progress.status ?? 'n/a'})`,
      `Day: ${progress.dayTitle ?? 'n/a'}`,
      `Exercises: ${progress.exercisesCompleted} completed / ${progress.exercisesSkipped} skipped / ${progress.exercisesPlanned} planned`,
      `Sets logged: ${progress.setsLogged}`,
      `Completed today: ${progress.workoutCompletedToday ? 'yes' : 'no'}`,
    ].join('\n');
  }

  private formatTodayMeals(ctx: CoachContext): string {
    if (ctx.todayMeals.length === 0) {
      return 'No meals logged yet today.';
    }
    return ctx.todayMeals
      .map(
        (m) =>
          `- ${m.mealType}: ${m.foodName} [${m.status}] ${m.calories} kcal / ${m.protein}g P`,
      )
      .join('\n');
  }

  private formatProgressSummary(ctx: CoachContext): string {
    const lines: string[] = [];
    if (ctx.latestProgress?.weightKg != null) {
      lines.push(`Latest weight: ${ctx.latestProgress.weightKg} kg`);
    }
    if (ctx.recentProgress.length >= 2) {
      const newest = ctx.recentProgress[0].weightKg;
      const oldest = ctx.recentProgress[ctx.recentProgress.length - 1].weightKg;
      if (newest != null && oldest != null) {
        const delta = Math.round((newest - oldest) * 10) / 10;
        lines.push(
          `Weight change (last ${ctx.recentProgress.length} logs): ${delta > 0 ? '+' : ''}${delta} kg`,
        );
      }
    }
    if (ctx.latestCheckin) {
      lines.push(
        `Today check-in: meals ${ctx.latestCheckin.mealsCompleted}/${ctx.latestCheckin.mealsCompleted + ctx.latestCheckin.mealsSkipped}, workout ${ctx.latestCheckin.workoutCompleted ? 'done' : 'pending'}, water ${ctx.latestCheckin.waterIntakeMl ?? 0} ml`,
      );
    }
    return lines.length > 0 ? lines.join('\n') : 'No progress logs yet.';
  }
}
