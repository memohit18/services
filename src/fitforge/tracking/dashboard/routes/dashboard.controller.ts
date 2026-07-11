import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import { DashboardService } from '../services/dashboard.service';

@ApiTags('Dashboard (Phase 8.2)')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary:
      'Daily dashboard — score, meals, workout, water, macros, streak, achievements',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getDashboard(@CurrentUser() user: CurrentUserPayload) {
    return this.dashboardService
      .getDashboard(user.userId)
      .then((data) => successResponse(data));
  }

  @Get('today')
  @ApiOperation({
    summary:
      "Today's score card with remaining calories/protein (rebuilds from events)",
  })
  @ApiResponse({ status: 200 })
  getToday(@CurrentUser() user: CurrentUserPayload) {
    return this.dashboardService
      .getToday(user.userId)
      .then((data) => successResponse(data));
  }

  @Get('compliance')
  @ApiOperation({
    summary:
      'Compliance breakdown (meals 30%, workout 30%, calories 15%, protein 15%, water 10%)',
  })
  @ApiResponse({ status: 200 })
  getCompliance(@CurrentUser() user: CurrentUserPayload) {
    return this.dashboardService
      .getCompliance(user.userId)
      .then((data) => successResponse(data));
  }

  @Get('streak')
  @ApiOperation({ summary: 'Current / longest compliance streak + unlocked achievements' })
  @ApiResponse({ status: 200 })
  getStreak(@CurrentUser() user: CurrentUserPayload) {
    return this.dashboardService
      .getStreak(user.userId)
      .then((data) => successResponse(data));
  }

  @Get('summary')
  @ApiOperation({ summary: 'Today + week + month rollup summary' })
  @ApiResponse({ status: 200 })
  getSummary(@CurrentUser() user: CurrentUserPayload) {
    return this.dashboardService
      .getSummary(user.userId)
      .then((data) => successResponse(data));
  }
}
