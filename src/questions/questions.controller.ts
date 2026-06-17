import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { BulkUploadQuestionsDto } from './dto/bulk-upload-questions.dto';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';
import { QuestionsService } from './questions.service';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  findAll(@Query() query: ListQuestionsQueryDto) {
    return this.questionsService.findAll(query);
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
  bulkUpload(@Body() dto: BulkUploadQuestionsDto) {
    return this.questionsService.bulkUpload(dto);
  }
}
