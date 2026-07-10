import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { successResponse } from '../../../../common/utils/api-response';
import { CreateCheckinDto } from '../dto/create-checkin.dto';
import { CreateWorkoutSessionDto } from '../dto/create-workout-session.dto';
import { LogHydrationDto } from '../dto/log-hydration.dto';
import { CheckinsService } from '../services/checkins.service';
import { HydrationService } from '../services/hydration.service';
import { WorkoutSessionService } from '../services/workout-session.service';

@ApiTags('Daily Checkins')
@ApiBearerAuth()
@Controller('checkins')
export class CheckinsController {
  constructor(
    private readonly checkinsService: CheckinsService,
    private readonly hydrationService: HydrationService,
    private readonly workoutSessionService: WorkoutSessionService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Record / refresh daily check-in (aggregates raw events; legacy fields optional)',
  })
  checkin(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCheckinDto,
  ) {
    return this.checkinsService
      .checkin(user.userId, dto)
      .then((data) => successResponse(data, 'Check-in recorded'));
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Rebuild today\'s DailyCheckin from meal/hydration/workout/progress events',
  })
  refresh(@CurrentUser() user: CurrentUserPayload) {
    return this.checkinsService
      .refreshToday(user.userId)
      .then((data) => successResponse(data, 'Daily summary refreshed'));
  }

  @Get('today')
  @ApiOperation({
    summary:
      "Today's score — calories, protein, meals, workout, water, compliance",
  })
  today(@CurrentUser() user: CurrentUserPayload) {
    return this.checkinsService
      .getTodayScore(user.userId)
      .then((data) => successResponse(data));
  }

  @Post('hydration')
  @ApiOperation({ summary: 'Log hydration event (source of truth for water)' })
  logHydration(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: LogHydrationDto,
  ) {
    return this.hydrationService
      .log(user.userId, dto.amountMl)
      .then(({ log, hydration, checkin }) =>
        successResponse(
          { log, hydration, checkin },
          'Hydration logged',
        ),
      );
  }

  @Post('workout-sessions')
  @ApiOperation({ summary: 'Log workout session (day-level execution event)' })
  logWorkoutSession(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateWorkoutSessionDto,
  ) {
    return this.workoutSessionService
      .log(user.userId, dto)
      .then((data) => successResponse(data, 'Workout session logged'));
  }

  @Get('workout-sessions/today')
  @ApiOperation({ summary: 'List today\'s workout session logs' })
  todaySessions(@CurrentUser() user: CurrentUserPayload) {
    return this.workoutSessionService
      .listToday(user.userId)
      .then((data) => successResponse(data));
  }

  @Get()
  @ApiOperation({ summary: 'List aggregated daily check-ins' })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.checkinsService.findAll(user.userId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Monthly check-in stats' })
  stats(@CurrentUser() user: CurrentUserPayload) {
    return this.checkinsService
      .getMonthlyStats(user.userId)
      .then((data) => successResponse(data));
  }
}
