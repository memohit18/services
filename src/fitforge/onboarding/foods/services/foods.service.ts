import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getPagination } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { normalizeDietType } from '../../../shared/utils/fitness-normalizers';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateFoodDto } from '../dto/create-food.dto';
import { ListFoodsQueryDto } from '../dto/list-foods-query.dto';
import { UpdateFoodDto } from '../dto/update-food.dto';

@Injectable()
export class FoodsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFoodDto) {
    return this.prisma.foodMaster.create({
      data: {
        ...dto,
        dietType: dto.dietType ? normalizeDietType(dto.dietType) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateFoodDto) {
    await this.findOne(id);
    return this.prisma.foodMaster.update({
      where: { id },
      data: {
        ...dto,
        dietType: dto.dietType ? normalizeDietType(dto.dietType) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.foodMaster.delete({ where: { id } });
    return { id };
  }

  async findOne(id: string) {
    const food = await this.prisma.foodMaster.findUnique({ where: { id } });
    if (!food) {
      throw new NotFoundException('Food not found');
    }
    return food;
  }

  async search(query: ListFoodsQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.FoodMasterWhereInput = {};

    if (query.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }
    if (query.dietType) {
      where.dietType = normalizeDietType(query.dietType);
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.foodMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.foodMaster.count({ where }),
    ]);

    return paginatedResponse(items, total, page, limit);
  }
}
