import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { CreateDietDto } from '../dto/create-diet.dto';
import { CreateDietFromAiTargetsDto } from '../dto/create-diet-from-ai-targets.dto';
import {
  DietPlanResponseDto,
  toDietPlanResponse,
} from '../dto/diet-plan-response.dto';
import { DietService } from '../services/diet.service';

@ApiTags('Diet')
@ApiBearerAuth()
@Controller('diet')
export class DietController {
  constructor(
    private readonly dietService: DietService,
    private readonly aiDietTargets: AiDietTargetsService,
  ) {}

  @Post('generate-targets')
  @ApiOperation({
    summary:
      'Generate diet macro targets — calories/protein from transformation engine, carbs/fats from AI',
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
    summary: 'Save AI macro targets (no meals) — use POST /meal-plans/generate next',
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
  @ApiOperation({ summary: 'Create diet plan version' })
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
  @ApiOperation({ summary: 'Get active diet plan' })
  @ApiResponse({ type: DietPlanResponseDto })
  getActive(@CurrentUser() user: CurrentUserPayload) {
    return this.dietService
      .getActive(user.userId)
      .then((plan) => successResponse(toDietPlanResponse(plan)));
  }

  @Get('history')
  @ApiOperation({ summary: 'Get diet plan history' })
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

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate diet plan version' })
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
}
