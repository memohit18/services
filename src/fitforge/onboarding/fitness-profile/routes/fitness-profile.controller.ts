import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import { CreateFitnessProfileDto } from '../dto/create-fitness-profile.dto';
import {
  FitnessMetricsResponseDto,
  FitnessProfileResponseDto,
} from '../dto/fitness-profile-response.dto';
import { UpdateFitnessProfileDto } from '../dto/update-fitness-profile.dto';
import { FitnessProfileService } from '../services/fitness-profile.service';

@ApiTags('Fitness Profile')
@ApiBearerAuth()
@Controller('fitness-profile')
export class FitnessProfileController {
  constructor(private readonly fitnessProfileService: FitnessProfileService) {}

  @Post()
  @ApiOperation({ summary: 'Create fitness profile' })
  @ApiResponse({ status: 201, type: FitnessProfileResponseDto })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateFitnessProfileDto,
  ) {
    return this.fitnessProfileService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Fitness profile created'));
  }

  @Get()
  @ApiOperation({ summary: 'Get fitness profile' })
  @ApiResponse({ status: 200, type: FitnessProfileResponseDto })
  get(@CurrentUser() user: CurrentUserPayload) {
    return this.fitnessProfileService
      .getByUserId(user.userId)
      .then((data) => successResponse(data));
  }

  @Put()
  @ApiOperation({ summary: 'Update fitness profile' })
  @ApiResponse({ status: 200, type: FitnessProfileResponseDto })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateFitnessProfileDto,
  ) {
    return this.fitnessProfileService
      .update(user.userId, dto)
      .then((data) => successResponse(data, 'Fitness profile updated'));
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Calculate BMI, BMR, TDEE, protein target' })
  @ApiResponse({ status: 200, type: FitnessMetricsResponseDto })
  metrics(@CurrentUser() user: CurrentUserPayload) {
    return this.fitnessProfileService
      .getMetrics(user.userId)
      .then((data) => successResponse(data));
  }
}
