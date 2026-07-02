import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import { UpdateOnboardingDto } from '../dto/update-onboarding.dto';
import { UserOnboardingService } from '../services/user-onboarding.service';

@ApiTags('Onboarding')
@ApiBearerAuth()
@Controller('onboarding')
export class UserOnboardingController {
  constructor(private readonly onboardingService: UserOnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'Get onboarding progress (creates record on first call)' })
  get(@CurrentUser() user: CurrentUserPayload) {
    return this.onboardingService
      .getOrCreate(user.userId)
      .then((data) => successResponse(data));
  }

  @Patch()
  @ApiOperation({ summary: 'Set current onboarding step (cannot go backwards)' })
  updateStep(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateOnboardingDto,
  ) {
    return this.onboardingService
      .updateStep(user.userId, dto)
      .then((data) => successResponse(data, 'Onboarding step updated'));
  }

  @Post('complete')
  @ApiOperation({ summary: 'Mark onboarding as completed' })
  complete(@CurrentUser() user: CurrentUserPayload) {
    return this.onboardingService
      .complete(user.userId)
      .then((data) => successResponse(data, 'Onboarding completed'));
  }
}
