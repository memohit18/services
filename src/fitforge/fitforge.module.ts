import { Module } from '@nestjs/common';
import { CacheModule } from './infrastructure/cache/cache.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { UserOnboardingModule } from './onboarding/user-onboarding/user-onboarding.module';
import { FitnessModule } from './onboarding/fitness/fitness.module';
import { FitnessProfileModule } from './onboarding/fitness-profile/fitness-profile.module';
import { FoodPreferencesModule } from './onboarding/food-preferences/food-preferences.module';
import { FoodsModule } from './onboarding/foods/foods.module';
import { PhysiqueGoalsModule } from './onboarding/physique-goals/physique-goals.module';
import { DietModule } from './planning/diet/diet.module';
import { GroceryModule } from './planning/grocery/grocery.module';
import { MealPlansModule } from './planning/meal-plans/meal-plans.module';
import { TransformationModule } from './planning/transformation/transformation.module';
import { CheckinsModule } from './tracking/checkins/checkins.module';
import { MealLogsModule } from './tracking/meal-logs/meal-logs.module';
import { ProgressModule } from './tracking/progress/progress.module';
import { WorkoutsModule } from './training/workouts/workouts.module';
import { UploadsModule } from './media/uploads/uploads.module';
import { GeminiModule } from './ai/gemini/gemini.module';
import { AiChatModule } from './ai/chat/ai-chat.module';
import { AiGenerationModule } from './ai/generation/ai-generation.module';

@Module({
  imports: [
    RedisModule,
    GeminiModule,
    UserOnboardingModule,
    FitnessModule,
    FitnessProfileModule,
    PhysiqueGoalsModule,
    FoodPreferencesModule,
    FoodsModule,
    TransformationModule,
    DietModule,
    MealPlansModule,
    MealLogsModule,
    GroceryModule,
    WorkoutsModule,
    ProgressModule,
    CheckinsModule,
    UploadsModule,
    AiChatModule,
    AiGenerationModule,
    CacheModule,
  ],
})
export class FitforgeModule {}
