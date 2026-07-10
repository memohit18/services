import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AiGenerationPipeline,
  buildWorkoutPlanPrompt,
  normalizeWorkoutPlan,
  validateWorkoutPlanResponse,
  type NormalizedWorkoutPlan,
} from '../pipeline';
import { AiContextService } from '../shared/ai-context.service';

type WorkoutPlanContext = {
  userId: string;
  profile: NonNullable<
    Awaited<ReturnType<AiContextService['buildCoachContext']>>['profile']
  >;
  daysPerWeek: number;
  exerciseNames: string[];
  prompt: string;
};

@Injectable()
export class AiWorkoutPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: AiContextService,
    private readonly pipeline: AiGenerationPipeline,
  ) {}

  async generate(userId: string) {
    const { data } = await this.pipeline.runJson<
      WorkoutPlanContext,
      ReturnType<typeof validateWorkoutPlanResponse>,
      NormalizedWorkoutPlan,
      Awaited<ReturnType<PrismaService['workoutPlan']['create']>>
    >({
      collectContext: async () => {
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
        const exerciseNames = catalog.map((e) => e.name);
        const prompt = buildWorkoutPlanPrompt({
          daysPerWeek,
          fitnessGoal: profile.fitnessGoal,
          experienceLevel: profile.experienceLevel ?? 'beginner',
          workoutMode: profile.workoutMode ?? 'gym',
          exerciseNames,
        });

        return {
          userId,
          profile,
          daysPerWeek,
          exerciseNames,
          prompt,
        };
      },
      buildPrompt: (context) => context.prompt,
      validate: validateWorkoutPlanResponse,
      normalize: (raw, context) =>
        normalizeWorkoutPlan(
          raw,
          context.daysPerWeek,
          context.profile.fitnessGoal,
        ),
      save: async (normalized, context) => {
        const latest = await this.prisma.workoutPlan.findFirst({
          where: { userId: context.userId },
          orderBy: { version: 'desc' },
        });
        const version = (latest?.version ?? 0) + 1;

        const dayCreates = [];
        for (const day of normalized.days) {
          const exerciseCreates = [];
          for (const ex of day.exercises) {
            const exercise = await this.resolveExercise(ex.name);
            exerciseCreates.push({
              exerciseId: exercise.id,
              sets: ex.sets,
              reps: ex.reps,
              restSeconds: ex.restSeconds,
            });
          }
          dayCreates.push({
            dayNumber: day.dayNumber,
            title: day.title,
            exercises: exerciseCreates.length
              ? { create: exerciseCreates }
              : undefined,
          });
        }

        return this.prisma.workoutPlan.create({
          data: {
            userId: context.userId,
            version,
            status: 'draft',
            goal: normalized.goal ?? context.profile.fitnessGoal,
            daysPerWeek: normalized.daysPerWeek,
            generatedBy: 'ai',
            aiPrompt: context.prompt,
            days: { create: dayCreates },
          },
          include: {
            days: {
              orderBy: { dayNumber: 'asc' },
              include: { exercises: { include: { exercise: true } } },
            },
          },
        });
      },
    });

    return data;
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
