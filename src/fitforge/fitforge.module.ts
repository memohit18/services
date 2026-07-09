import { Module } from '@nestjs/common';
import { RedisModule } from './infrastructure/redis/redis.module';
import { UserOnboardingModule } from './onboarding/user-onboarding/user-onboarding.module';
import { FitnessModule } from './onboarding/fitness/fitness.module';
import { FoodPreferencesModule } from './onboarding/food-preferences/food-preferences.module';
import { FoodsModule } from './onboarding/foods/foods.module';
import { TransformationModule } from './planning/transformation/transformation.module';

@Module({
  imports: [
    RedisModule,
    UserOnboardingModule,
    FitnessModule,
    FoodPreferencesModule,
    FoodsModule,
    TransformationModule,
  ],
})
export class FitforgeModule {}
