import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
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
import { TransformationResponseDto } from '../dto/transformation-response.dto';
import { TransformationService } from '../services/transformation.service';

@ApiTags('Transformation')
@ApiBearerAuth()
@Controller('transformation')
export class TransformationController {
  constructor(private readonly transformationService: TransformationService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Generate transformation plan from fitness profile (deterministic — no AI)',
  })
  @ApiResponse({ status: 201, type: TransformationResponseDto })
  generate(@CurrentUser() user: CurrentUserPayload) {
    return this.transformationService
      .generate(user.userId)
      .then((data) =>
        successResponse(data, 'Transformation generated successfully'),
      );
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active transformation plan' })
  @ApiResponse({ status: 200, type: TransformationResponseDto })
  getActive(@CurrentUser() user: CurrentUserPayload) {
    return this.transformationService
      .getActive(user.userId)
      .then((data) => successResponse(data));
  }

  @Get('history')
  @ApiOperation({ summary: 'Get transformation history (newest first)' })
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.transformationService.getHistory(user.userId, query);
  }

  @Get(':id/milestones')
  @ApiOperation({ summary: 'Get transformation milestones' })
  getMilestones(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.transformationService
      .getMilestones(user.userId, id)
      .then((data) => successResponse(data));
  }
}
