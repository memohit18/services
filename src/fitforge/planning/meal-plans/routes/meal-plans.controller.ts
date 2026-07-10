import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { successResponse } from '../../../../common/utils/api-response';
import { AiMealPlanService } from '../../../ai/generation/ai-meal-plan.service';
import { CreateMealPlanItemDto } from '../dto/create-meal-plan-item.dto';
import { CreateMealPlanDto } from '../dto/create-meal-plan.dto';
import { GenerateMealPlanDto } from '../dto/generate-meal-plan.dto';
import { ReplaceMealDto } from '../dto/replace-meal.dto';
import { UpdateMealPlanItemDto } from '../dto/update-meal-plan-item.dto';
import { MealGeneratorService } from '../services/meal-generator.service';
import { MealPlansService } from '../services/meal-plans.service';
import { MealTrackingService } from '../services/meal-tracking.service';

@ApiTags('Meal Plans')
@ApiBearerAuth()
@Controller('meal-plans')
export class MealPlansController {
  constructor(
    private readonly mealPlansService: MealPlansService,
    private readonly mealGeneratorService: MealGeneratorService,
    private readonly mealTrackingService: MealTrackingService,
    private readonly aiMealPlanService: AiMealPlanService,
  ) {}

  // ─── Phase 5 primary ─────────────────────────────────────────────

  @Post('generate')
  @ApiOperation({
    summary:
      'Phase 5: Generate meal plan from active (or given) diet — normalizes AI JSON when present',
  })
  generate(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: GenerateMealPlanDto,
  ) {
    return this.mealPlansService
      .generateFromDiet(user.userId, dto)
      .then((data) => successResponse(data, 'Meal plan generated'));
  }

  @Post('generate-ai')
  @ApiOperation({
    summary: 'Legacy: AI suggests meal names → FoodMaster + MealPlanItem',
  })
  generateAi(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: GenerateMealPlanDto,
  ) {
    if (!dto.dietPlanId || !dto.planType) {
      return this.mealPlansService
        .generateFromDiet(user.userId, dto)
        .then((data) => successResponse(data, 'AI meal plan generated'));
    }
    return this.aiMealPlanService
      .generate(user.userId, {
        dietPlanId: dto.dietPlanId,
        planType: dto.planType,
        days: dto.days,
      })
      .then((data) => successResponse(data, 'AI meal plan generated'));
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active meal plan' })
  getActive(@CurrentUser() user: CurrentUserPayload) {
    return this.mealPlansService
      .getActive(user.userId)
      .then((data) => successResponse(data));
  }

  @Get('today')
  @ApiOperation({ summary: "Phase 5: Today's meals with completion status" })
  getToday(
    @CurrentUser() user: CurrentUserPayload,
    @Query('date') date?: string,
  ) {
    return this.mealTrackingService
      .getToday(user.userId, date)
      .then((data) => successResponse(data));
  }

  @Get('nutrition-summary')
  @ApiOperation({
    summary:
      'Phase 5: Daily nutrition summary — calories/protein/carbs/fats + remaining + completion %',
  })
  getNutritionSummary(
    @CurrentUser() user: CurrentUserPayload,
    @Query('date') date?: string,
  ) {
    return this.mealTrackingService
      .getNutritionSummary(user.userId, date)
      .then((data) => successResponse(data));
  }

  @Get('history')
  @ApiOperation({ summary: 'Get meal plan history' })
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.mealPlansService.getHistory(user.userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create empty meal plan shell (draft)' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateMealPlanDto,
  ) {
    return this.mealPlansService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Meal plan created'));
  }

  // Item actions — registered before :id routes that share a UUID param
  @Post(':mealItemId/complete')
  @ApiOperation({ summary: 'Phase 5: Mark meal completed' })
  complete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('mealItemId') mealItemId: string,
  ) {
    return this.mealTrackingService
      .complete(user.userId, mealItemId)
      .then((data) => successResponse(data, 'Meal completed'));
  }

  @Post(':mealItemId/skip')
  @ApiOperation({ summary: 'Phase 5: Skip meal' })
  skip(
    @CurrentUser() user: CurrentUserPayload,
    @Param('mealItemId') mealItemId: string,
  ) {
    return this.mealTrackingService
      .skip(user.userId, mealItemId)
      .then((data) => successResponse(data, 'Meal skipped'));
  }

  @Post(':mealItemId/replace')
  @ApiOperation({
    summary: 'Phase 5: Replace meal with macro-compatible food',
  })
  @ApiResponse({ status: 200 })
  replace(
    @CurrentUser() user: CurrentUserPayload,
    @Param('mealItemId') mealItemId: string,
    @Body() dto: ReplaceMealDto,
  ) {
    return this.mealTrackingService
      .replace(user.userId, mealItemId, dto)
      .then((data) => successResponse(data, 'Meal replaced'));
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate meal plan version' })
  activate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.mealPlansService
      .activate(user.userId, id)
      .then((data) => successResponse(data, 'Meal plan activated'));
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Get weekly meal schedule' })
  getSchedule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.mealPlansService
      .getSchedule(user.userId, id)
      .then((data) => successResponse(data));
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add meal plan item' })
  addItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreateMealPlanItemDto,
  ) {
    return this.mealPlansService
      .addItem(user.userId, id, dto)
      .then((data) => successResponse(data, 'Meal item added'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Phase 5: Get complete meal plan by id' })
  getById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.mealPlansService
      .getById(user.userId, id)
      .then((data) => successResponse(data));
  }

  @Put('items/:itemId')
  @ApiOperation({ summary: 'Update meal plan item' })
  updateItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMealPlanItemDto,
  ) {
    return this.mealPlansService
      .updateItem(user.userId, itemId, dto)
      .then((data) => successResponse(data, 'Meal item updated'));
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Delete meal plan item' })
  deleteItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param('itemId') itemId: string,
  ) {
    return this.mealPlansService
      .deleteItem(user.userId, itemId)
      .then((data) => successResponse(data, 'Meal item deleted'));
  }
}
