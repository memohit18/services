import { ApiOperation } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getRequestMetadata } from '../common/utils/request-metadata.util';
import { ListUserProgressQueryDto } from './dto/list-user-progress-query.dto';
import { DailyActivityQueryDto } from './dto/daily-activity-query.dto';
import { UpdateUserProgressDto } from './dto/update-user-progress.dto';
import { UserProgressService } from './user-progress.service';

@Controller('user-progress')
export class UserProgressController {
  constructor(private readonly userProgressService: UserProgressService) {}

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListUserProgressQueryDto,
  ) {
    return this.userProgressService.findAll(user.userId, query);
  }

  @Get('filters')
  getFilters(@CurrentUser() user: CurrentUserPayload) {
    return this.userProgressService.getFilterSummary(user.userId);
  }

  @Get('daily-activity')
  @ApiOperation({
    summary: 'Monthly daily activity — true if the user submitted at least one question that day',
  })
  getDailyActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: DailyActivityQueryDto,
  ) {
    return this.userProgressService.getDailyActivity(user.userId, query.month);
  }

  @Get(':questionId')
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return this.userProgressService.findOne(user.userId, questionId);
  }

  @Put(':questionId')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() dto: UpdateUserProgressDto,
    @Req() req: Request,
  ) {
    return this.userProgressService.update(user.userId, questionId, dto, {
      userId: user.userId,
      ...getRequestMetadata(req),
    });
  }
}
