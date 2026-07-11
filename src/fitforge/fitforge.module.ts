import { Module } from '@nestjs/common';
import { RedisModule } from './infrastructure/redis/redis.module';
import { UserOnboardingModule } from './onboarding/user-onboarding/user-onboarding.module';
import { FitnessModule } from './onboarding/fitness/fitness.module';
import { FoodPreferencesModule } from './onboarding/food-preferences/food-preferences.module';
import { FoodsModule } from './onboarding/foods/foods.module';
import { NutritionPreferencesModule } from './onboarding/nutrition-preferences/nutrition-preferences.module';
import { TransformationModule } from './planning/transformation/transformation.module';
import { DietModule } from './planning/diet/diet.module';
import { MealPlansModule } from './planning/meal-plans/meal-plans.module';
import { GroceryModule } from './planning/grocery/grocery.module';
import { MealsExecutionModule } from './execution/meals/meals-execution.module';
import { HydrationExecutionModule } from './execution/hydration/hydration-execution.module';
import { CheckinsModule } from './tracking/checkins/checkins.module';
import { DashboardModule } from './tracking/dashboard/dashboard.module';
import { ProgressModule } from './tracking/progress/progress.module';
import { UploadsModule } from './media/uploads/uploads.module';
import { WorkoutsModule } from './training/workouts/workouts.module';
import { AiChatModule } from './ai/chat/ai-chat.module';

@Module({
  imports: [
    RedisModule,
    UserOnboardingModule,
    FitnessModule,
    FoodPreferencesModule,
    FoodsModule,
    NutritionPreferencesModule,
    TransformationModule,
    DietModule,
    MealPlansModule,
    GroceryModule,
    MealsExecutionModule,
    HydrationExecutionModule,
    WorkoutsModule,
    CheckinsModule,
    DashboardModule,
    ProgressModule,
    UploadsModule,
    AiChatModule,
  ],
})
export class FitforgeModule {}
