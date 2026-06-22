import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { CreatePhysiqueGoalDto } from '../dto/create-physique-goal.dto';

const SEED_GOALS: Omit<CreatePhysiqueGoalDto, 'imageUrl'>[] = [
  { name: 'Lean', description: 'Visible abs, low body fat', targetBodyFatMin: 10, targetBodyFatMax: 14 },
  { name: 'Athletic', description: 'Lean and functional', targetBodyFatMin: 12, targetBodyFatMax: 16 },
  { name: 'Muscular', description: 'Balanced muscle with definition', targetBodyFatMin: 14, targetBodyFatMax: 18 },
  { name: 'Bodybuilder', description: 'Maximum muscle mass', targetBodyFatMin: 8, targetBodyFatMax: 12 },
  { name: 'Powerlifter', description: 'Strength-focused build', targetBodyFatMin: 16, targetBodyFatMax: 22 },
  { name: 'Slim', description: 'Light and toned physique', targetBodyFatMin: 18, targetBodyFatMax: 24 },
];

@Injectable()
export class PhysiqueGoalsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    const count = await this.prisma.physiqueGoal.count();
    if (count === 0) {
      await this.prisma.physiqueGoal.createMany({
        data: SEED_GOALS,
      });
    }
  }

  async create(dto: CreatePhysiqueGoalDto) {
    const goal = await this.prisma.physiqueGoal.create({ data: dto });
    await this.redis.del(FitForgeCacheKeys.physiqueGoals());
    return goal;
  }

  async findAll() {
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

  async findOne(id: string) {
    const goal = await this.prisma.physiqueGoal.findUnique({ where: { id } });
    if (!goal) {
      throw new NotFoundException('Physique goal not found');
    }
    return goal;
  }
}
