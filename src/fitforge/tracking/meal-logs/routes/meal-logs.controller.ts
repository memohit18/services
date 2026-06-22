import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import { CreateMealLogDto } from '../dto/create-meal-log.dto';
import { MealLogsService } from '../services/meal-logs.service';

@ApiTags('Meal Tracking')
@ApiBearerAuth()
@Controller('meal-logs')
export class MealLogsController {
  constructor(private readonly mealLogsService: MealLogsService) {}

  @Post()
  @ApiOperation({ summary: 'Log meal (completed, skipped, or replaced)' })
  @ApiResponse({ status: 201 })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateMealLogDto,
  ) {
    return this.mealLogsService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Meal logged'));
  }
}
