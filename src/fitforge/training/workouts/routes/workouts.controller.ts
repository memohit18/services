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
import { CreateWorkoutDto } from '../dto/create-workout.dto';
import { WorkoutsService } from '../services/workouts.service';

@ApiTags('Workouts')
@ApiBearerAuth()
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post()
  @ApiOperation({ summary: 'Create workout plan version' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateWorkoutDto,
  ) {
    return this.workoutsService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Workout plan created'));
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active workout plan' })
  getActive(@CurrentUser() user: CurrentUserPayload) {
    return this.workoutsService.getActive(user.userId).then((data) => successResponse(data));
  }

  @Get('history')
  @ApiOperation({ summary: 'Get workout plan history' })
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.workoutsService.getHistory(user.userId, query);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate workout plan version' })
  activate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.workoutsService
      .activate(user.userId, id)
      .then((data) => successResponse(data, 'Workout plan activated'));
  }
}
