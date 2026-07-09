import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../../auth/decorators/public.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import {
  CreateFitnessProfileApiDto,
  UpdateFitnessProfileApiDto,
} from '../dto/fitness-profile-api.dto';
import { FitnessApiService } from '../services/fitness-api.service';

@ApiTags('Fitness (Frontend API)')
@Controller('fitness')
export class FitnessController {
  constructor(private readonly fitnessApiService: FitnessApiService) {}

  @Public()
  @Get('goals')
  @ApiOperation({ summary: 'List physique goals for onboarding Step 5' })
  @ApiResponse({ status: 200, description: '{ goals: [{ id, title, description, imageUrl }] }' })
  getGoals() {
    return this.fitnessApiService
      .getGoals()
      .then((data) => successResponse(data));
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user fitness profile' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.fitnessApiService
      .getProfile(user.userId)
      .then((data) => successResponse(data));
  }

  @Post('profile')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create fitness profile (first-time onboarding)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409, description: 'Profile already exists' })
  createProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateFitnessProfileApiDto,
  ) {
    return this.fitnessApiService
      .createProfile(user.userId, dto)
      .then((data) =>
        successResponse(data, 'Fitness profile created successfully'),
      );
  }

  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Partially update fitness profile' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateFitnessProfileApiDto,
  ) {
    return this.fitnessApiService
      .updateProfile(user.userId, dto)
      .then((data) =>
        successResponse(data, 'Fitness profile updated successfully'),
      );
  }
}
