import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import {
  dayBoundsUtc,
  startOfLocalCalendarDay,
} from '../../../tracking/checkins/aggregator/daily-aggregator.engine';
import { HydrationLogRepository } from '../../../tracking/checkins/repositories/hydration-log.repository';
import { HydrationService } from '../../../tracking/checkins/services/hydration.service';
import { LogHydrationDto } from '../dto/log-hydration.dto';

@ApiTags('Hydration')
@ApiBearerAuth()
@Controller('hydration')
export class HydrationController {
  constructor(
    private readonly hydrationService: HydrationService,
    private readonly hydrationLogRepository: HydrationLogRepository,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Log water intake (updates daily check-in immediately)' })
  log(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: LogHydrationDto,
  ) {
    return this.hydrationService
      .log(user.userId, dto.amountMl)
      .then(({ log, hydration, checkin }) =>
        successResponse({ log, hydration, checkin }, 'Hydration logged'),
      );
  }

  @Get('today')
  @ApiOperation({ summary: "Today's hydration total + events" })
  async today(@CurrentUser() user: CurrentUserPayload) {
    const start = startOfLocalCalendarDay();
    const { end } = dayBoundsUtc(start);
    const logs = await this.hydrationLogRepository.findForDay(
      user.userId,
      start,
      end,
    );
    const currentMl = logs.reduce((sum, l) => sum + l.amountMl, 0);
    return successResponse({
      date: start.toISOString().slice(0, 10),
      ...this.hydrationService.formatHydration(currentMl),
      events: logs.map((l) => ({
        id: l.id,
        amountMl: l.amountMl,
        loggedAt: l.loggedAt,
      })),
    });
  }
}
