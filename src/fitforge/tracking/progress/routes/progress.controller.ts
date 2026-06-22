import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
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
import { CreateProgressDto } from '../dto/create-progress.dto';
import { UpdateProgressDto } from '../dto/update-progress.dto';
import { ProgressService } from '../services/progress.service';

@ApiTags('Progress')
@ApiBearerAuth()
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post()
  @ApiOperation({ summary: 'Add progress log' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProgressDto,
  ) {
    return this.progressService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Progress logged'));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update progress log' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.progressService
      .update(user.userId, id, dto)
      .then((data) => successResponse(data, 'Progress updated'));
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get progress analytics' })
  analytics(@CurrentUser() user: CurrentUserPayload) {
    return this.progressService
      .getAnalytics(user.userId)
      .then((data) => successResponse(data));
  }

  @Get()
  @ApiOperation({ summary: 'List progress logs' })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.progressService.findAll(user.userId, query);
  }
}
