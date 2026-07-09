import { Injectable, NotFoundException } from '@nestjs/common';
import { FOOD_CATEGORIES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { getPagination } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { normalizeDietType } from '../../../shared/utils/fitness-normalizers';
import { FOOD_CATEGORY_LABELS } from '../constants/food-category.normalizer';
import { ListFoodsQueryDto } from '../dto/list-foods-query.dto';
import { FoodsRepository } from '../repositories/foods.repository';

@Injectable()
export class FoodsService {
  constructor(private readonly foodsRepository: FoodsRepository) {}

  async findAll(userId: string, query: ListFoodsQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const { items, total } = await this.foodsRepository.findAll({
      userId,
      skip,
      take: limit,
      category: query.category,
      dietType: query.dietType ? normalizeDietType(query.dietType) : undefined,
      search: query.search,
    });
    return paginatedResponse(items, total, page, limit);
  }

  async findById(id: string) {
    const food = await this.foodsRepository.findById(id);
    if (!food || !food.isVerified) {
      throw new NotFoundException('Food not found');
    }
    return food;
  }

  async getCategories() {
    const categories = await this.foodsRepository.categories();
    return {
      allowedCategories: FOOD_CATEGORIES.map((id) => ({
        id,
        label: FOOD_CATEGORY_LABELS[id],
      })),
      categories: categories.map((category) => ({
        ...category,
        label: FOOD_CATEGORY_LABELS[category.id as keyof typeof FOOD_CATEGORY_LABELS] ?? category.id,
      })),
    };
  }
}
