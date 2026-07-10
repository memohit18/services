import {
  Body,
  Controller,
  Delete,
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
import { successResponse } from '../../../../common/utils/api-response';
import { CreateProgressPhotosDto } from '../dto/create-progress-photos.dto';
import { CreateProgressDto } from '../dto/create-progress.dto';
import {
  ProgressAnalyticsQueryDto,
  ProgressHistoryQueryDto,
  ProgressPhotosQueryDto,
} from '../dto/progress-query.dto';
import { UpdateProgressDto } from '../dto/update-progress.dto';
import {
  ProgressLogResponseDto,
  ProgressPhotoResponseDto,
} from '../mappers/progress.mapper';
import { ProgressService } from '../services/progress.service';

@ApiTags('Progress')
@ApiBearerAuth()
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post()
  @ApiOperation({
    summary: 'Create progress entry (one per day — upserts today)',
  })
  @ApiResponse({ status: 201, type: ProgressLogResponseDto })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProgressDto,
  ) {
    return this.progressService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Progress logged'));
  }

  @Get('latest')
  @ApiOperation({
    summary: 'Get latest progress entry (data is null when none logged yet)',
  })
  @ApiResponse({ status: 200, type: ProgressLogResponseDto })
  getLatest(@CurrentUser() user: CurrentUserPayload) {
    return this.progressService
      .getLatest(user.userId)
      .then((data) => successResponse(data));
  }

  @Get('history')
  @ApiOperation({
    summary: 'Progress history with optional date range + pagination',
  })
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ProgressHistoryQueryDto,
  ) {
    return this.progressService.getHistory(user.userId, query);
  }

  @Get('analytics')
  @ApiOperation({
    summary:
      'Progress analytics — trends, weekly change, goal %, ETA, consistency, narrative insights',
  })
  getAnalytics(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ProgressAnalyticsQueryDto,
  ) {
    return this.progressService
      .getAnalytics(user.userId, query)
      .then((data) => successResponse(data));
  }

  @Get('dashboard')
  @ApiOperation({
    summary:
      'Progress dashboard — latest log + analytics + addictive narrative insights',
  })
  getDashboard(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ProgressAnalyticsQueryDto,
  ) {
    return this.progressService
      .getDashboard(user.userId, query)
      .then((data) => successResponse(data));
  }

  @Post('photos')
  @ApiOperation({
    summary:
      'Save progress photos (front/side/back). Upload files to R2 via /uploads/presigned-url first, then pass public URLs here.',
  })
  @ApiResponse({ status: 201, type: ProgressPhotoResponseDto })
  createPhotos(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProgressPhotosDto,
  ) {
    return this.progressService
      .createPhotos(user.userId, dto)
      .then((data) => successResponse(data, 'Progress photos saved'));
  }

  @Get('photos')
  @ApiOperation({ summary: 'Progress photo timeline (newest first)' })
  listPhotos(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ProgressPhotosQueryDto,
  ) {
    return this.progressService.listPhotos(user.userId, query);
  }

  @Delete('photos/:id')
  @ApiOperation({ summary: 'Delete progress photo set (best-effort R2 cleanup)' })
  deletePhoto(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.progressService
      .deletePhoto(user.userId, id)
      .then((data) => successResponse(data, 'Progress photo deleted'));
  }

  /** Legacy list — same as /history */
  @Get()
  @ApiOperation({ summary: 'List progress logs (legacy alias of /history)' })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ProgressHistoryQueryDto,
  ) {
    return this.progressService.findAll(user.userId, query);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a progress log by id' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.progressService
      .update(user.userId, id, dto)
      .then((data) => successResponse(data, 'Progress updated'));
  }
}
