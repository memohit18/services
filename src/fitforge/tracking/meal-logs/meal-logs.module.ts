import { Module } from '@nestjs/common';
import { MealLogsController } from './routes/meal-logs.controller';
import { MealLogsService } from './services/meal-logs.service';

@Module({
  controllers: [MealLogsController],
  providers: [MealLogsService],
})
export class MealLogsModule {}
