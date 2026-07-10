import { Injectable } from '@nestjs/common';
import type { DietPlan, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class DietRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string, userId: string) {
    return this.prisma.dietPlan.findFirst({ where: { id, userId } });
  }

  findActive(userId: string) {
    return this.prisma.dietPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { version: 'desc' },
      include: {
        mealPlans: {
          where: { status: 'active' },
          take: 1,
          include: {
            items: {
              include: { food: true },
              orderBy: [{ dayNumber: 'asc' }, { mealType: 'asc' }],
            },
          },
        },
      },
    });
  }

  findHistory(userId: string, skip: number, take: number) {
    return Promise.all([
      this.prisma.dietPlan.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { version: 'desc' },
        select: {
          id: true,
          version: true,
          status: true,
          goal: true,
          caloriesTarget: true,
          proteinTarget: true,
          carbsTarget: true,
          fatsTarget: true,
          generatedBy: true,
          aiMetadata: true,
          createdAt: true,
          startDate: true,
          endDate: true,
        },
      }),
      this.prisma.dietPlan.count({ where: { userId } }),
    ]);
  }

  latestVersion(userId: string) {
    return this.prisma.dietPlan.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
  }

  async createActiveVersion(params: {
    userId: string;
    transformationId: string | null;
    version: number;
    data: {
      goal: string;
      caloriesTarget: number;
      proteinTarget: number;
      carbsTarget: number;
      fatsTarget: number;
      prompt: string;
      responseJson: Prisma.InputJsonValue;
      aiMetadata: Prisma.InputJsonValue;
      generatedBy: string;
    };
  }): Promise<DietPlan> {
    return this.prisma.$transaction(async (tx) => {
      await tx.dietPlan.updateMany({
        where: { userId: params.userId, status: 'active' },
        data: { status: 'archived', endDate: new Date() },
      });

      await tx.mealPlan.updateMany({
        where: { userId: params.userId, status: 'active' },
        data: { status: 'archived', endDate: new Date() },
      });

      return tx.dietPlan.create({
        data: {
          userId: params.userId,
          transformationId: params.transformationId,
          version: params.version,
          status: 'active',
          startDate: new Date(),
          goal: params.data.goal,
          caloriesTarget: params.data.caloriesTarget,
          proteinTarget: params.data.proteinTarget,
          carbsTarget: params.data.carbsTarget,
          fatsTarget: params.data.fatsTarget,
          prompt: params.data.prompt,
          responseJson: params.data.responseJson,
          aiMetadata: params.data.aiMetadata,
          generatedBy: params.data.generatedBy,
        },
      });
    });
  }

  async deleteById(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.dietPlan.findFirst({ where: { id, userId } });
      if (!plan) {
        return null;
      }

      const mealPlans = await tx.mealPlan.findMany({
        where: { dietPlanId: id },
        select: { id: true },
      });
      const mealPlanIds = mealPlans.map((m) => m.id);

      if (mealPlanIds.length > 0) {
        await tx.mealPlanItem.deleteMany({
          where: { mealPlanId: { in: mealPlanIds } },
        });
        await tx.mealPlan.deleteMany({ where: { id: { in: mealPlanIds } } });
      }

      await tx.dietPlan.delete({ where: { id } });
      return plan;
    });
  }
}
