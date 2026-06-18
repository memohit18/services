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
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getRequestMetadata } from '../common/utils/request-metadata.util';
import { BulkUploadQuestionsDto } from './dto/bulk-upload-questions.dto';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';
import { QuestionsService } from './questions.service';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListQuestionsQueryDto,
  ) {
    return this.questionsService.findAll(query, user.userId);
  }

  @Get('filters')
  getFilters() {
    return this.questionsService.getFilters();
  }

  @Get(':questionId')
  findOne(@Param('questionId', ParseIntPipe) questionId: number) {
    return this.questionsService.findOne(questionId);
  }

  @Post('bulk')
  bulkUpload(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BulkUploadQuestionsDto,
    @Req() req: Request,
  ) {
    return this.questionsService.bulkUpload(dto, {
      userId: user.userId,
      ...getRequestMetadata(req),
    });
  }
}
