import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { successResponse } from '../../../../common/utils/api-response';
import { CheckinsService } from '../services/checkins.service';
import { CreateCheckinDto } from '../dto/create-checkin.dto';

@ApiTags('Daily Checkins')
@ApiBearerAuth()
@Controller('checkins')
export class CheckinsController {
  constructor(private readonly checkinsService: CheckinsService) {}

  @Post()
  @ApiOperation({ summary: 'Daily check-in' })
  checkin(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCheckinDto,
  ) {
    return this.checkinsService
      .checkin(user.userId, dto)
      .then((data) => successResponse(data, 'Check-in recorded'));
  }

  @Get()
  @ApiOperation({ summary: 'List check-ins' })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.checkinsService.findAll(user.userId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Monthly check-in stats' })
  stats(@CurrentUser() user: CurrentUserPayload) {
    return this.checkinsService
      .getMonthlyStats(user.userId)
      .then((data) => successResponse(data));
  }
}
