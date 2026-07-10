import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { AiDietTargetsService } from '../../../ai/generation/ai-diet-targets.service';
import { AddHydrationDto } from '../dto/add-hydration.dto';
import { CreateDietDto } from '../dto/create-diet.dto';
import { CreateDietFromAiTargetsDto } from '../dto/create-diet-from-ai-targets.dto';
import {
  DietPlanResponseDto,
  GeneratedDietPlanResponseDto,
  toDietPlanResponse,
  toGeneratedDietResponse,
} from '../dto/diet-plan-response.dto';
import { DietPlannerQueryDto } from '../dto/diet-planner-query.dto';
import { DietPlannerService } from '../services/diet-planner.service';
import { DietService } from '../services/diet.service';

@ApiTags('Diet')
@ApiBearerAuth()
@Controller('diet')
export class DietController {
  constructor(
    private readonly dietService: DietService,
    private readonly aiDietTargets: AiDietTargetsService,
    private readonly dietPlannerService: DietPlannerService,
  ) {}

  // ─── Phase 4 (new) ───────────────────────────────────────────────

  @Post('generate')
  @ApiOperation({
    summary:
      'Phase 4: Generate full AI diet — raw JSON on diet_plans + meal_plans/items',
  })
  @ApiResponse({ status: 201, type: GeneratedDietPlanResponseDto })
  generate(@CurrentUser() user: CurrentUserPayload) {
    return this.dietService
      .generate(user.userId)
      .then((result) =>
        successResponse(
          toGeneratedDietResponse(result),
          'Diet plan generated successfully',
        ),
      );
  }

  @Post('regenerate')
  @ApiOperation({
    summary: 'Phase 4: Regenerate AI diet (archives previous active)',
  })
  @ApiResponse({ status: 201, type: GeneratedDietPlanResponseDto })
  regenerate(@CurrentUser() user: CurrentUserPayload) {
    return this.dietService
      .regenerate(user.userId)
      .then((result) =>
        successResponse(
          toGeneratedDietResponse(result),
          'Diet plan regenerated successfully',
        ),
      );
  }

  // ─── Legacy (keep request/response contracts unchanged) ──────────

  @Post('generate-targets')
  @ApiOperation({
    summary:
      'Legacy: Generate diet macro targets — calories/protein from transformation, carbs/fats from AI',
  })
  @ApiResponse({ type: DietPlanResponseDto })
  generateTargets(@CurrentUser() user: CurrentUserPayload) {
    return this.aiDietTargets
      .generateAndSave(user.userId)
      .then((plan) =>
        successResponse(toDietPlanResponse(plan), 'Diet targets generated'),
      );
  }

  @Post('from-targets')
  @ApiOperation({
    summary:
      'Legacy: Save AI macro targets (no meals) — use POST /meal-plans/generate next',
  })
  @ApiResponse({ type: DietPlanResponseDto })
  createFromAiTargets(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateDietFromAiTargetsDto,
  ) {
    return this.dietService
      .createFromAiTargets(user.userId, dto)
      .then((plan) =>
        successResponse(toDietPlanResponse(plan), 'Diet targets saved'),
      );
  }

  @Post()
  @ApiOperation({ summary: 'Legacy: Create diet plan version (manual)' })
  @ApiResponse({ type: DietPlanResponseDto })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateDietDto,
  ) {
    return this.dietService
      .create(user.userId, dto)
      .then((plan) =>
        successResponse(toDietPlanResponse(plan), 'Diet plan created'),
      );
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active diet plan (legacy response shape)' })
  @ApiResponse({ status: 200, type: DietPlanResponseDto })
  getActive(@CurrentUser() user: CurrentUserPayload) {
    return this.dietService
      .getActive(user.userId)
      .then((plan) => successResponse(toDietPlanResponse(plan)));
  }

  @Get('history')
  @ApiOperation({ summary: 'Get diet plan history (legacy response shape)' })
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.dietService.getHistory(user.userId, query).then((result) => ({
      ...result,
      data: {
        ...result.data,
        items: result.data.items.map(toDietPlanResponse),
      },
    }));
  }

  @Get('planner')
  @ApiOperation({
    summary:
      'Diet Planner dashboard — today’s meals, macros, hydration, coach insight',
  })
  getPlanner(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: DietPlannerQueryDto,
  ) {
    return this.dietPlannerService
      .getDashboard(user.userId, query.date)
      .then((data) => successResponse(data));
  }

  @Patch('planner/hydration')
  @ApiOperation({ summary: 'Add water intake for today' })
  addHydration(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AddHydrationDto,
  ) {
    return this.dietPlannerService
      .addHydration(user.userId, dto.amountMl)
      .then((data) => successResponse(data, 'Hydration updated'));
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Legacy: Activate diet plan version' })
  @ApiResponse({ type: DietPlanResponseDto })
  activate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.dietService
      .activate(user.userId, id)
      .then((plan) =>
        successResponse(
          plan ? toDietPlanResponse(plan) : null,
          'Diet plan activated',
        ),
      );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Phase 4: Delete a diet plan and its meal plans' })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.dietService
      .delete(user.userId, id)
      .then((data) => successResponse(data, 'Diet plan deleted'));
  }
}
