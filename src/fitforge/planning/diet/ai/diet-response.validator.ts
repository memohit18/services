import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AiDietResponseSchema,
  type AiDietResponse,
} from './diet-response.schema';

export type DietValidationContext = {
  engineCalories: number;
  engineProtein: number;
  restrictedFoods: string[];
  allowedFoodNames: string[];
};

@Injectable()
export class DietResponseValidator {
  validate(raw: unknown, ctx: DietValidationContext): AiDietResponse {
    const parsed = AiDietResponseSchema.safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');
      throw new BadRequestException(`Invalid AI diet response: ${details}`);
    }

    const data = parsed.data;
    this.assertMacros(data, ctx);
    this.assertFoods(data, ctx);
    return data;
  }

  private assertMacros(data: AiDietResponse, ctx: DietValidationContext) {
    const calorieDrift =
      Math.abs(data.dailyCalories - ctx.engineCalories) / ctx.engineCalories;
    if (calorieDrift > 0.1) {
      throw new BadRequestException(
        `AI dailyCalories ${data.dailyCalories} is outside 10% of engine target ${ctx.engineCalories}`,
      );
    }

    const proteinDrift =
      Math.abs(data.dailyProtein - ctx.engineProtein) / ctx.engineProtein;
    if (proteinDrift > 0.1) {
      throw new BadRequestException(
        `AI dailyProtein ${data.dailyProtein} is outside 10% of engine target ${ctx.engineProtein}`,
      );
    }

    const macroKcal =
      data.dailyProtein * 4 + data.dailyCarbs * 4 + data.dailyFats * 9;
    const macroDrift = Math.abs(macroKcal - data.dailyCalories) / data.dailyCalories;
    if (macroDrift > 0.2) {
      throw new BadRequestException(
        `AI macros (${Math.round(macroKcal)} kcal) do not match dailyCalories ${data.dailyCalories}`,
      );
    }
  }

  private assertFoods(data: AiDietResponse, ctx: DietValidationContext) {
    if (data.meals.length === 0) {
      throw new BadRequestException('AI diet response is missing meals');
    }

    const restricted = new Set(
      ctx.restrictedFoods.map((name) => name.trim().toLowerCase()),
    );
    const allowed = new Set(
      ctx.allowedFoodNames.map((name) => name.trim().toLowerCase()),
    );

    for (const meal of data.meals) {
      const key = meal.foodName.trim().toLowerCase();
      if (restricted.has(key)) {
        throw new BadRequestException(
          `AI diet includes restricted food: ${meal.foodName}`,
        );
      }
      if (allowed.size > 0 && !allowed.has(key)) {
        throw new BadRequestException(
          `AI diet includes unknown food: ${meal.foodName}`,
        );
      }
    }
  }
}
