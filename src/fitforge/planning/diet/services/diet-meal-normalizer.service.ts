import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MealPlanNormalizer } from '../../meal-plans/services/meal-plan-normalizer.service';

/**
 * @deprecated Prefer {@link MealPlanNormalizer} — kept so DietService callers stay stable.
 */
@Injectable()
export class DietMealNormalizerService {
  constructor(private readonly mealPlanNormalizer: MealPlanNormalizer) {}

  async materializeFromDietPlan(params: {
    userId: string;
    dietPlanId: string;
    planType?: string;
  }) {
    if (!params.dietPlanId) {
      throw new BadRequestException('dietPlanId is required');
    }
    if (!params.userId) {
      throw new NotFoundException('userId is required');
    }
    return this.mealPlanNormalizer.materializeFromDietPlan(params);
  }
}
