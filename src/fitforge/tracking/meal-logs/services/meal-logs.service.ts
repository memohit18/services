import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateMealLogDto } from '../dto/create-meal-log.dto';

@Injectable()
export class MealLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMealLogDto) {
    const item = await this.prisma.mealPlanItem.findFirst({
      where: { id: dto.mealPlanItemId, mealPlan: { userId } },
      include: { food: true },
    });
    if (!item) {
      throw new NotFoundException('Meal plan item not found');
    }

    if (dto.status === 'replaced' && !dto.replacementFoodId) {
      throw new BadRequestException('replacementFoodId is required when status is replaced');
    }

    if (dto.replacementFoodId) {
      const replacement = await this.prisma.foodMaster.findUnique({
        where: { id: dto.replacementFoodId },
      });
      if (!replacement) {
        throw new NotFoundException('Replacement food not found');
      }
    }

    return this.prisma.mealLog.create({
      data: {
        userId,
        mealPlanItemId: dto.mealPlanItemId,
        status: dto.status,
        originalFoodId: dto.originalFoodId ?? item.foodId,
        replacementFoodId: dto.replacementFoodId,
        actualCalories: item.calories,
        actualProtein: item.protein,
        consumedAt: new Date(),
      },
      include: {
        mealPlanItem: { include: { food: true } },
        replacementFood: true,
        originalFood: true,
      },
    });
  }
}
