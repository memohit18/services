import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module';
import { MealPlansModule } from '../../planning/meal-plans/meal-plans.module';
import { FoodsController } from './routes/foods.controller';
import { FoodsRepository } from './repositories/foods.repository';
import { FoodsService } from './services/foods.service';

@Module({
  imports: [AuthModule, MealPlansModule],
  controllers: [FoodsController],
  providers: [FoodsService, FoodsRepository],
  exports: [FoodsService, FoodsRepository],
})
export class FoodsModule {}
