import { Injectable, NotFoundException } from '@nestjs/common';
import { getPagination } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { normalizeDietType } from '../../../shared/utils/fitness-normalizers';
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
    return { categories };
  }
}
