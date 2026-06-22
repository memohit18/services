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
import { CreateMealPlanItemDto } from '../dto/create-meal-plan-item.dto';
import { CreateMealPlanDto } from '../dto/create-meal-plan.dto';
import { UpdateMealPlanItemDto } from '../dto/update-meal-plan-item.dto';
import { MealPlansService } from '../services/meal-plans.service';

@ApiTags('Meal Plans')
@ApiBearerAuth()
@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Post()
  @ApiOperation({ summary: 'Create meal plan' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateMealPlanDto,
  ) {
    return this.mealPlansService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Meal plan created'));
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active meal plan' })
  getActive(@CurrentUser() user: CurrentUserPayload) {
    return this.mealPlansService
      .getActive(user.userId)
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
