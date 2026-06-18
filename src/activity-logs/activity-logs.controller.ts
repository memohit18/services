import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ActivityLogsService } from './activity-logs.service';
import { ListActivityLogsQueryDto } from './dto/list-activity-logs-query.dto';

@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListActivityLogsQueryDto,
  ) {
    return this.activityLogsService.findAll(user.userId, query);
  }

  @Get('filters')
  getFilters(@CurrentUser() user: CurrentUserPayload) {
    return this.activityLogsService.getFilterOptions(user.userId);
  }

  @Get(':activityLogId')
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('activityLogId') activityLogId: string,
  ) {
    return this.activityLogsService.findOne(user.userId, activityLogId);
  }
}
