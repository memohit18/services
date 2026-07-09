import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateNutritionPreferencesDto } from '../dto/create-nutrition-preferences.dto';
import { UpdateNutritionPreferencesDto } from '../dto/update-nutrition-preferences.dto';
import { toNutritionPreferencesView } from '../mappers/nutrition-preferences.mapper';
import {
  NutritionPreferencesRepository,
  type NutritionPreferencesUpdateInput,
} from '../repositories/nutrition-preferences.repository';

@Injectable()
export class NutritionPreferencesService {
  constructor(
    private readonly nutritionPreferencesRepository: NutritionPreferencesRepository,
  ) {}

  async findByUserId(userId: string) {
    const preference = await this.nutritionPreferencesRepository.findByUserId(userId);
    if (!preference) {
      throw new NotFoundException('Nutrition preferences not found');
    }
    return toNutritionPreferencesView(preference);
  }

  async create(userId: string, dto: CreateNutritionPreferencesDto) {
    const exists = await this.nutritionPreferencesRepository.exists(userId);
    if (exists) {
      throw new ConflictException('Nutrition preferences already exist for this user');
    }

    const created = await this.nutritionPreferencesRepository.create(userId, dto);
    return toNutritionPreferencesView(created);
  }

  async update(userId: string, dto: UpdateNutritionPreferencesDto) {
    const exists = await this.nutritionPreferencesRepository.exists(userId);
    if (!exists) {
      throw new NotFoundException('Nutrition preferences not found');
    }

    const updated = await this.nutritionPreferencesRepository.update(
      userId,
      this.toUpdateInput(dto),
    );
    return toNutritionPreferencesView(updated);
  }

  async remove(userId: string) {
    const exists = await this.nutritionPreferencesRepository.exists(userId);
    if (!exists) {
      throw new NotFoundException('Nutrition preferences not found');
    }
    await this.nutritionPreferencesRepository.delete(userId);
    return { userId };
  }

  private toUpdateInput(
    dto: UpdateNutritionPreferencesDto,
  ): NutritionPreferencesUpdateInput {
    const data: NutritionPreferencesUpdateInput = {};
    if (dto.budgetCategory !== undefined) data.budgetCategory = dto.budgetCategory;
    if (dto.preferredCuisine !== undefined) data.preferredCuisine = dto.preferredCuisine;
    if (dto.mealsPerDay !== undefined) data.mealsPerDay = dto.mealsPerDay;
    if (dto.cookingTimeMinutes !== undefined) {
      data.cookingTimeMinutes = dto.cookingTimeMinutes;
    }
    if (dto.preferredMealTiming !== undefined) {
      data.preferredMealTiming = dto.preferredMealTiming;
    }
    return data;
  }
}
