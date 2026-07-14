import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { toGoalSlug } from '../../fitness/mappers/fitness-api.mapper';
import { CreatePhysiqueGoalDto } from '../dto/create-physique-goal.dto';
import { UpdatePhysiqueGoalDto } from '../dto/update-physique-goal.dto';

const GOALS_IMAGE_BASE =
  process.env.FITNESS_GOALS_IMAGE_BASE ?? 'https://cdn.fitforge.app/goals';

type SeedGoal = {
  name: string;
  description: string;
  targetBodyFatMin: number;
  targetBodyFatMax: number;
};

const SEED_GOAL_DEFS: SeedGoal[] = [
  {
    name: 'Lean',
    description: 'Visible abs, low body fat',
    targetBodyFatMin: 10,
    targetBodyFatMax: 14,
  },
  {
    name: 'Athletic',
    description: 'Lean and functional',
    targetBodyFatMin: 12,
    targetBodyFatMax: 16,
  },
  {
    name: 'Muscular',
    description: 'Balanced muscle with definition',
    targetBodyFatMin: 14,
    targetBodyFatMax: 18,
  },
  {
    name: 'Bodybuilder',
    description: 'Maximum muscle mass',
    targetBodyFatMin: 8,
    targetBodyFatMax: 12,
  },
  {
    name: 'Powerlifter',
    description: 'Strength-focused build',
    targetBodyFatMin: 16,
    targetBodyFatMax: 22,
  },
  {
    name: 'Slim',
    description: 'Light and toned physique',
    targetBodyFatMin: 18,
    targetBodyFatMax: 24,
  },
];

function defaultImageUrl(name: string): string {
  return `${GOALS_IMAGE_BASE.replace(/\/$/, '')}/${toGoalSlug(name)}.jpg`;
}

@Injectable()
export class PhysiqueGoalsService {
  private readonly logger = new Logger(PhysiqueGoalsService.name);
  private seedChecked = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreatePhysiqueGoalDto) {
    const goal = await this.prisma.physiqueGoal.create({
      data: {
        ...dto,
        imageUrl: dto.imageUrl ?? defaultImageUrl(dto.name),
      },
    });
    await this.redis.del(FitForgeCacheKeys.physiqueGoals());
    this.seedChecked = true;
    return goal;
  }

  async update(idOrSlug: string, dto: UpdatePhysiqueGoalDto) {
    await this.ensureSeeded();
    const existing = await this.resolveGoal(idOrSlug);
    const goal = await this.prisma.physiqueGoal.update({
      where: { id: existing.id },
      data: dto,
    });
    await this.redis.del(FitForgeCacheKeys.physiqueGoals());
    return goal;
  }

  async findAll() {
    await this.ensureSeeded();

    const cacheKey = FitForgeCacheKeys.physiqueGoals();
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const goals = await this.prisma.physiqueGoal.findMany({
      orderBy: { name: 'asc' },
    });
    await this.redis.set(cacheKey, goals, FitForgeCacheTTL.PHYSIQUE_GOALS);
    return goals;
  }

  async findOne(idOrSlug: string) {
    await this.ensureSeeded();
    return this.resolveGoal(idOrSlug);
  }

  /** Accepts DB uuid or slug from GET /fitness/goals (e.g. lean, bodybuilder). */
  private async resolveGoal(idOrSlug: string) {
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (UUID_REGEX.test(idOrSlug)) {
      const byId = await this.prisma.physiqueGoal.findUnique({
        where: { id: idOrSlug },
      });
      if (byId) return byId;
    }

    const goals = await this.prisma.physiqueGoal.findMany();
    const normalized = idOrSlug.trim().toLowerCase();
    const bySlug = goals.find((g) => toGoalSlug(g.name) === normalized);
    if (!bySlug) {
      throw new NotFoundException('Physique goal not found');
    }
    return bySlug;
  }

  /**
   * Seed reference goals on first read — avoids blocking app boot if DB is not up yet.
   * Also backfills missing imageUrl so profile onboarding cards always have art URLs.
   */
  private async ensureSeeded() {
    if (this.seedChecked) {
      return;
    }

    const count = await this.prisma.physiqueGoal.count();
    if (count === 0) {
      await this.prisma.physiqueGoal.createMany({
        data: SEED_GOAL_DEFS.map((g) => ({
          ...g,
          imageUrl: defaultImageUrl(g.name),
        })),
      });
      this.logger.log(`Seeded ${SEED_GOAL_DEFS.length} physique goals`);
    } else {
      const missingImages = await this.prisma.physiqueGoal.findMany({
        where: { OR: [{ imageUrl: null }, { imageUrl: '' }] },
        select: { id: true, name: true },
      });
      if (missingImages.length) {
        await Promise.all(
          missingImages.map((g) =>
            this.prisma.physiqueGoal.update({
              where: { id: g.id },
              data: { imageUrl: defaultImageUrl(g.name) },
            }),
          ),
        );
        await this.redis.del(FitForgeCacheKeys.physiqueGoals());
        this.logger.log(
          `Backfilled imageUrl for ${missingImages.length} physique goals`,
        );
      }
    }

    this.seedChecked = true;
  }
}
