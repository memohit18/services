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

const WORKOUT_GIF_BASE = 'https://cdn.algoarena.co.in/catalog/workout-gifs/v2';

/** Clips whose equipment must stay on the stable illustrated loop. */
const LOCKED_MOVEMENT_GIFS: Record<string, string> = {
  'seated cable rows':
    'https://cdn.algoarena.co.in/catalog/workout-gifs/v8/seated-cable-rows.gif',
};

function movementGifUrl(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const locked = LOCKED_MOVEMENT_GIFS[key];
  if (locked) return locked;
  const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug ? `${WORKOUT_GIF_BASE}/${slug}.gif` : null;
}

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

  /** Fill catalog clips on the user's current workout. Existing clips are kept. */
  async ensureMovementGifs(userId: string) {
    const exercises = await this.prisma.exerciseMaster.findMany({
      where: {
        workoutExercises: {
          some: { workoutDay: { workoutPlan: { userId } } },
        },
      },
    });
    for (const exercise of exercises) {
      await this.withMovementGif(exercise);
    }
  }

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
        const workoutMode = profile.workoutMode ?? 'gym';
        const equipmentAvailable = normalizeEquipmentList(
          profile.equipmentAvailable,
        );
        // Home with equipment → include equipment moves; home/calisthenics
        // without gear → bodyweight-only catalog.
        const bodyweightOnly =
          (workoutMode === 'calisthenics' || workoutMode === 'home') &&
          equipmentAvailable.length === 0;
        const catalog = await this.prisma.exerciseMaster.findMany({
          where: bodyweightOnly ? { equipmentRequired: false } : undefined,
          take: 80,
          orderBy: { name: 'asc' },
          select: { name: true, muscleGroup: true },
        });
        // Fall back to full catalog if bodyweight-only set is too thin.
        const resolvedCatalog =
          bodyweightOnly && catalog.length < 12
            ? await this.prisma.exerciseMaster.findMany({
                take: 80,
                orderBy: { name: 'asc' },
                select: { name: true, muscleGroup: true },
              })
            : catalog;
        const exerciseNames = resolvedCatalog.map((e) => e.name);
        const prompt = buildWorkoutPlanPrompt({
          daysPerWeek,
          fitnessGoal: profile.fitnessGoal,
          experienceLevel: profile.experienceLevel ?? 'beginner',
          workoutMode,
          equipmentAvailable,
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
      return this.withMovementGif(exact);
    }

    const created = await this.prisma.exerciseMaster.create({
      data: {
        name,
        equipmentRequired: true,
        imageUrl: movementGifUrl(name),
      },
    });
    return created;
  }

  /** Keep an existing catalog clip. Fill a missing one with the same illustrated GIF. */
  private async withMovementGif(exercise: {
    id: string;
    name: string;
    imageUrl: string | null;
  }) {
    const url = movementGifUrl(exercise.name);
    if (!url) return exercise;
    const locked = exercise.name.trim().toLowerCase() in LOCKED_MOVEMENT_GIFS;
    if (exercise.imageUrl && !locked) return exercise;
    if (exercise.imageUrl === url) return exercise;
    return this.prisma.exerciseMaster.update({
      where: { id: exercise.id },
      data: { imageUrl: url },
    });
  }
}

function normalizeEquipmentList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}
