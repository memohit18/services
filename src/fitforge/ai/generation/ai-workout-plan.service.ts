import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { AiContextService } from '../shared/ai-context.service';

type AiWorkoutExercise = {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
};

type AiWorkoutDay = {
  dayNumber: number;
  title: string;
  exercises: AiWorkoutExercise[];
};

type AiWorkoutPlanResponse = {
  goal?: string;
  daysPerWeek?: number;
  days: AiWorkoutDay[];
};

@Injectable()
export class AiWorkoutPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly contextService: AiContextService,
  ) {}

  async generate(userId: string) {
    const ctx = await this.contextService.buildCoachContext(userId);
    if (!ctx.profile) {
      throw new NotFoundException('Fitness profile required');
    }

    const profile = ctx.profile;
    const daysPerWeek = profile.workoutDaysPerWeek ?? 5;

    const catalog = await this.prisma.exerciseMaster.findMany({
      take: 80,
      orderBy: { name: 'asc' },
      select: { name: true, muscleGroup: true },
    });

    const prompt = `Generate a ${daysPerWeek}-day workout plan. Return JSON only.

User:
Goal: ${profile.fitnessGoal}
Experience: ${profile.experienceLevel ?? 'beginner'}
Workout mode: ${profile.workoutMode ?? 'gym'}
Days per week: ${daysPerWeek}

Available exercises (prefer these names):
${catalog.map((e) => e.name).join(', ')}

Return format:
{
  "goal": "${profile.fitnessGoal}",
  "daysPerWeek": ${daysPerWeek},
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

    const aiPlan = await this.gemini.generateJson<AiWorkoutPlanResponse>(prompt);
    if (!aiPlan.days?.length) {
      throw new BadRequestException('AI returned no workout days');
    }

    const latest = await this.prisma.workoutPlan.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    const dayCreates = [];
    for (const day of aiPlan.days) {
      const exerciseCreates = [];
      for (const ex of day.exercises ?? []) {
        const exercise = await this.resolveExercise(ex.name);
        exerciseCreates.push({
          exerciseId: exercise.id,
          sets: ex.sets,
          reps: String(ex.reps),
          restSeconds: ex.restSeconds,
        });
      }
      dayCreates.push({
        dayNumber: day.dayNumber,
        title: day.title,
        exercises: exerciseCreates.length ? { create: exerciseCreates } : undefined,
      });
    }

    return this.prisma.workoutPlan.create({
      data: {
        userId,
        version,
        status: 'draft',
        goal: aiPlan.goal ?? profile.fitnessGoal,
        daysPerWeek: aiPlan.daysPerWeek ?? daysPerWeek,
        generatedBy: 'ai',
        aiPrompt: prompt,
        days: { create: dayCreates },
      },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: { exercises: { include: { exercise: true } } },
        },
      },
    });
  }

  private async resolveExercise(name: string) {
    const exact = await this.prisma.exerciseMaster.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (exact) {
      return exact;
    }

    const fuzzy = await this.prisma.exerciseMaster.findFirst({
      where: { name: { contains: name, mode: 'insensitive' } },
    });
    if (fuzzy) {
      return fuzzy;
    }

    return this.prisma.exerciseMaster.create({
      data: { name, equipmentRequired: true },
    });
  }
}
