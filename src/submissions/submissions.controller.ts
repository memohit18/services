import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getRequestMetadata } from '../common/utils/request-metadata.util';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { ListSubmissionsQueryDto } from './dto/list-submissions-query.dto';
import { SubmissionsService } from './submissions.service';

@Controller('questions/:questionId/submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Submit solution — server runs all test cases and returns per-testcase results (including hidden)',
  })
  create(
    @Param('questionId', ParseIntPipe) questionId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSubmissionDto,
    @Req() req: Request,
  ) {
    return this.submissionsService.create(questionId, user.userId, dto, {
      userId: user.userId,
      ...getRequestMetadata(req),
    });
  }

  @Get()
  findAll(
    @Param('questionId', ParseIntPipe) questionId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListSubmissionsQueryDto,
  ) {
    return this.submissionsService.findAllForQuestion(
      questionId,
      user.userId,
      query,
    );
  }
}
