import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { successResponse } from '../common/utils/api-response';
import { CareerService } from './career.service';

@ApiTags('Career')
@ApiBearerAuth()
@Controller('career')
export class CareerController {
  constructor(private readonly careerService: CareerService) {}

  @Get()
  @ApiOperation({ summary: 'Career onboarding overview for current user' })
  overview(@CurrentUser() user: CurrentUserPayload) {
    return this.careerService
      .getOverview(user.userId)
      .then((data) => successResponse(data));
  }
}
