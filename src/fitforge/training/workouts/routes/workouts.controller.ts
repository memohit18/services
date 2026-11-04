import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { successResponse } from '../../../../common/utils/api-response';
import { AiWorkoutPlanService } from '../../../ai/generation/ai-workout-plan.service';
import { CreateWorkoutDayDto } from '../dto/create-workout-day.dto';
import { CreateWorkoutExerciseDto } from '../dto/create-workout-exercise.dto';
import { CreateWorkoutDto } from '../dto/create-workout.dto';
import { UpdateExerciseDto } from '../dto/update-exercise.dto';
import { UpdateWorkoutPlanExerciseDto } from '../dto/update-workout-plan-exercise.dto';
import { WorkoutSessionService } from '../execution/services/workout-session.service';
import { WorkoutsService } from '../services/workouts.service';

@ApiTags('Workouts')
@ApiBearerAuth()
@Controller('workouts')
export class WorkoutsController {
  constructor(
    private readonly workoutsService: WorkoutsService,
    private readonly aiWorkoutPlanService: AiWorkoutPlanService,
    private readonly workoutSessionService: WorkoutSessionService,
  ) {}

  @Post('generate-ai')
  @ApiOperation({
    summary:
      'AI generates workout plan and activates it (days + exercises)',
  })
  async generateAi(@CurrentUser() user: CurrentUserPayload) {
    const draft = await this.aiWorkoutPlanService.generate(user.userId);
    const data = await this.workoutsService.activate(user.userId, draft.id);
    return successResponse(data, 'AI workout plan generated and activated');
  }

  @Post()
  @ApiOperation({ summary: 'Create workout plan with optional structured days' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateWorkoutDto,
  ) {
    return this.workoutsService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Workout plan created'));
  }

  @Get('today')
  @ApiOperation({
    summary:
      "Today's planned workout day + active session (must be before :id)",
  })
  today(@CurrentUser() user: CurrentUserPayload) {
    return this.workoutSessionService
      .getToday(user.userId)
      .then((data) => successResponse(data));
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active workout plan with days and exercises' })
  getActive(@CurrentUser() user: CurrentUserPayload) {
    return this.workoutsService
      .getActive(user.userId)
      .then((data) => successResponse(data));
  }

  @Get('history')
  @ApiOperation({ summary: 'Get workout plan history (metadata only)' })
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.workoutsService.getHistory(user.userId, query);
  }

  @Get('exercises')
  @ApiOperation({
    summary: 'List exercise catalog (ExerciseMaster) including imageUrl',
  })
  listExercises() {
    return this.workoutsService
      .listExercises()
      .then((data) => successResponse(data, 'Exercises retrieved'));
  }

  @Get('exercises/:exerciseId')
  @ApiOperation({ summary: 'Get one exercise including imageUrl' })
  getExercise(@Param('exerciseId') exerciseId: string) {
    return this.workoutsService
      .getExercise(exerciseId)
      .then((data) => successResponse(data));
  }

  @Patch('exercises/:exerciseId')
  @ApiOperation({
    summary:
      'Update exercise demo image/GIF URL (pass URL from POST /images type=workout)',
  })
  updateExercise(
    @Param('exerciseId') exerciseId: string,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.workoutsService
      .updateExercise(exerciseId, dto)
      .then((data) => successResponse(data, 'Exercise updated'));
  }

  @Patch('items/:itemId')
  @ApiOperation({
    summary:
      'Update one exercise on the user’s plan (sets, reps, rest, notes)',
  })
  updatePlanExercise(
    @CurrentUser() user: CurrentUserPayload,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateWorkoutPlanExerciseDto,
  ) {
    return this.workoutsService
      .updatePlanExercise(user.userId, itemId, dto)
      .then((data) => successResponse(data, 'Workout exercise updated'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workout plan with days and exercises' })
  getById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.workoutsService
      .getById(user.userId, id)
      .then((data) => successResponse(data));
  }

  @Post(':id/days')
  @ApiOperation({ summary: 'Add a workout day to a plan' })
  addDay(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreateWorkoutDayDto,
  ) {
    return this.workoutsService
      .addDay(user.userId, id, dto)
      .then((data) => successResponse(data, 'Workout day added'));
  }

  @Post(':id/days/:dayId/exercises')
  @ApiOperation({ summary: 'Add an exercise to a workout day' })
  addExercise(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: CreateWorkoutExerciseDto,
  ) {
    return this.workoutsService
      .addExercise(user.userId, id, dayId, dto)
      .then((data) => successResponse(data, 'Exercise added'));
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
