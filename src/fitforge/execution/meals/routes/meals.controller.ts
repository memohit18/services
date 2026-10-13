import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import { MealTrackingService } from '../../../planning/meal-plans/services/meal-tracking.service';
import { CompleteMealDto } from '../dto/complete-meal.dto';
import { LogEatenMealDto } from '../dto/log-eaten-meal.dto';
import { PartialMealDto } from '../dto/partial-meal.dto';
import { ReplaceMealExecutionDto } from '../dto/replace-meal-execution.dto';

@ApiTags('Meal Execution')
@ApiBearerAuth()
@Controller('meals')
export class MealsController {
  constructor(private readonly mealTracking: MealTrackingService) {}

  @Post('log-eaten')
  @ApiOperation({
    summary:
      'Log an off-plan meal you already ate (adds to today + marks completed; quantity scales macros)',
  })
  logEaten(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: LogEatenMealDto,
  ) {
    return this.mealTracking
      .logEaten(user.userId, {
        foodId: dto.foodId,
        mealType: dto.mealType,
        quantity: dto.quantity,
        notes: dto.notes,
      })
      .then((data) => successResponse(data, 'Eaten meal logged'));
  }

  @Post(':mealId/complete')
  @ApiOperation({ summary: 'Mark meal as completed (updates nutrition + daily score)' })
  complete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('mealId') mealId: string,
    @Body() dto: CompleteMealDto,
  ) {
    return this.mealTracking
      .complete(user.userId, mealId, {
        consumedQuantity: dto.consumedQuantity,
        notes: dto.notes,
      })
      .then((data) => successResponse(data, 'Meal completed'));
  }

  @Post(':mealId/partial')
  @ApiOperation({ summary: 'Log partial meal consumption' })
  partial(
    @CurrentUser() user: CurrentUserPayload,
    @Param('mealId') mealId: string,
    @Body() dto: PartialMealDto,
  ) {
    return this.mealTracking
      .partial(user.userId, mealId, {
        consumedQuantity: dto.consumedQuantity,
        notes: dto.notes,
      })
      .then((data) => successResponse(data, 'Partial meal logged'));
  }

  @Post(':mealId/undo')
  @ApiOperation({
    summary: 'Undo today\'s ate, partial, or skip log and return the meal to pending',
  })
  undo(
    @CurrentUser() user: CurrentUserPayload,
    @Param('mealId') mealId: string,
  ) {
    return this.mealTracking
      .undo(user.userId, mealId)
      .then((data) => successResponse(data, 'Meal log reverted'));
  }

  @Post(':mealId/skip')
  @ApiOperation({ summary: 'Skip a planned meal' })
  skip(
    @CurrentUser() user: CurrentUserPayload,
    @Param('mealId') mealId: string,
  ) {
    return this.mealTracking
      .skip(user.userId, mealId)
      .then((data) => successResponse(data, 'Meal skipped'));
  }

  @Post(':mealId/replace')
  @ApiOperation({
    summary: 'Replace meal food (±10% calories & protein)',
  })
  replace(
    @CurrentUser() user: CurrentUserPayload,
    @Param('mealId') mealId: string,
    @Body() dto: ReplaceMealExecutionDto,
  ) {
    return this.mealTracking
      .replace(user.userId, mealId, {
        foodId: dto.foodId,
        quantity: dto.quantity,
      })
      .then((data) => successResponse(data, 'Meal replaced'));
  }
}
