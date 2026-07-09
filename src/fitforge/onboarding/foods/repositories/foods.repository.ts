import { Injectable } from '@nestjs/common';
import type { FoodMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

export interface FoodSearchParams {
  userId: string;
  skip: number;
  take: number;
  category?: string;
  dietType?: string;
  search?: string;
}

@Injectable()
export class FoodsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FoodSearchParams): Promise<{ items: FoodMaster[]; total: number }> {
    return this.search(params);
  }

  async search(params: FoodSearchParams): Promise<{ items: FoodMaster[]; total: number }> {
    const where = this.buildWhere(params);
    const [items, total] = await Promise.all([
      this.prisma.foodMaster.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.foodMaster.count({ where }),
    ]);
    return { items, total };
  }

  async categories(): Promise<string[]> {
    const rows = await this.prisma.foodMaster.findMany({
      where: { isVerified: true, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows
      .map((row) => row.category)
      .filter((category): category is string => category !== null);
  }

  async findById(id: string): Promise<FoodMaster | null> {
    return this.prisma.foodMaster.findUnique({ where: { id } });
  }

  async countByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    return this.prisma.foodMaster.count({ where: { id: { in: ids } } });
  }

  private buildWhere(params: FoodSearchParams): Prisma.FoodMasterWhereInput {
    const where: Prisma.FoodMasterWhereInput = {
      isVerified: true,
    };

    if (params.category) {
      where.category = { equals: params.category, mode: 'insensitive' };
    }
    if (params.dietType) {
      where.dietType = params.dietType;
    }
    if (params.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    return where;
  }
}
