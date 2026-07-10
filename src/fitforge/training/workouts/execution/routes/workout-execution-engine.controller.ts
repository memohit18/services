import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../../common/utils/api-response';
import { CompleteExerciseDto } from '../dto/complete-exercise.dto';
import { LogWorkoutSetDto } from '../dto/log-set.dto';
import { UpdateWorkoutSetDto } from '../dto/update-set.dto';
import { WorkoutExecutionEngineService } from '../services/workout-execution-engine.service';

@ApiTags('Workout Execution')
@ApiBearerAuth()
@Controller('workouts')
export class WorkoutExecutionEngineController {
  constructor(private readonly execution: WorkoutExecutionEngineService) {}

  @Post('exercises/:exerciseId/set')
  @ApiOperation({
    summary: 'Log a set (reps/weight/rest) — returns setId + rest timer seconds',
  })
  logSet(
    @CurrentUser() user: CurrentUserPayload,
    @Param('exerciseId') exerciseId: string,
    @Body() dto: LogWorkoutSetDto,
  ) {
    return this.execution
      .logSet(user.userId, exerciseId, dto)
      .then((data) => successResponse(data, 'Set logged'));
  }

  @Patch('exercises/:exerciseId/set/:setId')
  @ApiOperation({ summary: 'Update a logged set' })
  updateSet(
    @CurrentUser() user: CurrentUserPayload,
    @Param('exerciseId') exerciseId: string,
    @Param('setId') setId: string,
    @Body() dto: UpdateWorkoutSetDto,
  ) {
    return this.execution
      .updateSet(user.userId, exerciseId, setId, dto)
      .then((data) => successResponse(data, 'Set updated'));
  }

  @Post('exercises/:exerciseId/complete')
  @ApiOperation({
    summary: 'Mark exercise complete (or skip=true). Required before session end.',
  })
  complete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('exerciseId') exerciseId: string,
    @Body() dto: CompleteExerciseDto,
  ) {
    return this.execution
      .completeExercise(user.userId, exerciseId, dto)
      .then((data) =>
        successResponse(
          data,
          dto.skip ? 'Exercise skipped' : 'Exercise completed',
        ),
      );
  }
}
