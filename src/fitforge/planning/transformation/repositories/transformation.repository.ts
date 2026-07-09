import { Injectable } from '@nestjs/common';
import type { Prisma, TransformationTarget } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TRANSFORMATION_STATUS } from '../constants/transformation.constants';
import type { TransformationWithMilestones } from '../interfaces/transformation-plan.interface';

@Injectable()
export class TransformationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async archivePreviousActive(userId: string): Promise<void> {
    await this.prisma.transformationTarget.updateMany({
      where: { userId, status: TRANSFORMATION_STATUS.ACTIVE },
      data: { status: TRANSFORMATION_STATUS.ARCHIVED },
    });
  }

  async create(
    data: Prisma.TransformationTargetCreateInput,
  ): Promise<TransformationWithMilestones> {
    return this.prisma.transformationTarget.create({
      data,
      include: { milestones: { orderBy: { weekNumber: 'asc' } } },
    });
  }

  async findActive(userId: string): Promise<TransformationWithMilestones | null> {
    return this.prisma.transformationTarget.findFirst({
      where: { userId, status: TRANSFORMATION_STATUS.ACTIVE },
      include: { milestones: { orderBy: { weekNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findHistory(
    userId: string,
    skip: number,
    take: number,
  ): Promise<{ items: TransformationTarget[]; total: number }> {
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.transformationTarget.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transformationTarget.count({ where }),
    ]);
    return { items, total };
  }

  async findMilestones(
    userId: string,
    id: string,
  ): Promise<TransformationWithMilestones | null> {
    return this.prisma.transformationTarget.findFirst({
      where: { id, userId },
      include: { milestones: { orderBy: { weekNumber: 'asc' } } },
    });
  }

  async findPhysiqueGoal(id: string) {
    return this.prisma.physiqueGoal.findUnique({ where: { id } });
  }
}
