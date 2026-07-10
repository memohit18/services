import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import { CompleteWorkoutExerciseDto } from '../dto/complete-workout-exercise.dto';
import { EndWorkoutSessionDto } from '../dto/end-workout-session.dto';
import { StartWorkoutSessionDto } from '../dto/start-workout-session.dto';
import { WorkoutExecutionService } from '../services/workout-execution.service';

@ApiTags('Workout Execution')
@ApiBearerAuth()
@Controller('workouts')
export class WorkoutExecutionController {
  constructor(private readonly execution: WorkoutExecutionService) {}

  @Post('session/start')
  @ApiOperation({ summary: 'Start a workout session — returns sessionId' })
  start(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: StartWorkoutSessionDto,
  ) {
    return this.execution
      .startSession(user.userId, dto)
      .then((data) => successResponse(data, 'Workout session started'));
  }

  @Post('session/end')
  @ApiOperation({ summary: 'End a workout session — updates daily score' })
  end(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EndWorkoutSessionDto,
  ) {
    return this.execution
      .endSession(user.userId, dto)
      .then((data) => successResponse(data, 'Workout session completed'));
  }

  @Post('exercise/complete')
  @ApiOperation({ summary: 'Log completed exercise sets/reps/weight' })
  completeExercise(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CompleteWorkoutExerciseDto,
  ) {
    return this.execution
      .completeExercise(user.userId, dto)
      .then((data) => successResponse(data, 'Exercise logged'));
  }
}
