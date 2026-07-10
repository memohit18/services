import { Module } from '@nestjs/common';
import { MealPlansModule } from '../meal-plans/meal-plans.module';
import { GroceryController } from './routes/grocery.controller';
import { GroceryService } from './services/grocery.service';

@Module({
  imports: [MealPlansModule],
  controllers: [GroceryController],
  providers: [GroceryService],
  exports: [GroceryService],
})
export class GroceryModule {}
