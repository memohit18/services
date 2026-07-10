import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';
import { successResponse } from '../../../../../common/utils/api-response';
import { EndWorkoutSessionDto } from '../dto/end-session.dto';
import { StartWorkoutSessionDto } from '../dto/start-session.dto';
import { WorkoutSessionService } from '../services/workout-session.service';

@ApiTags('Workout Session')
@ApiBearerAuth()
@Controller('workouts')
export class WorkoutSessionController {
  constructor(private readonly sessions: WorkoutSessionService) {}

  @Get('sessions/history')
  @ApiOperation({ summary: 'Completed workout session history' })
  history(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.sessions
      .getHistory(user.userId, page, limit)
      .then((data) => successResponse(data));
  }

  @Get('session/active')
  @ApiOperation({ summary: 'Get the current open workout session (if any)' })
  activeSession(@CurrentUser() user: CurrentUserPayload) {
    return this.sessions
      .getActiveSession(user.userId)
      .then((data) => successResponse(data));
  }

  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Get session detail + analytics' })
  getSession(
    @CurrentUser() user: CurrentUserPayload,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessions
      .getSessionDetail(user.userId, sessionId)
      .then((data) => successResponse(data));
  }

  @Post('session/start')
  @ApiOperation({ summary: 'Start workout session (one active at a time)' })
  start(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: StartWorkoutSessionDto,
  ) {
    return this.sessions
      .start(user.userId, dto)
      .then((data) => successResponse(data, 'Workout session started'));
  }

  @Post('session/pause')
  @ApiOperation({ summary: 'Pause the active workout session' })
  pause(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EndWorkoutSessionDto,
  ) {
    return this.sessions
      .pause(user.userId, dto.sessionId)
      .then((data) => successResponse(data, 'Workout paused'));
  }

  @Post('session/resume')
  @ApiOperation({ summary: 'Resume a paused workout session' })
  resume(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EndWorkoutSessionDto,
  ) {
    return this.sessions
      .resume(user.userId, dto.sessionId)
      .then((data) => successResponse(data, 'Workout resumed'));
  }

  @Post('session/end')
  @ApiOperation({
    summary:
      'Finish workout — requires all exercises completed/skipped (or force=true)',
  })
  end(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EndWorkoutSessionDto,
  ) {
    return this.sessions
      .end(user.userId, dto)
      .then((data) => successResponse(data, 'Workout completed'));
  }
}
