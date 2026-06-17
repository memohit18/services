import { Body, Controller, Post } from '@nestjs/common';
import { BulkUploadQuestionsDto } from './dto/bulk-upload-questions.dto';
import { QuestionsService } from './questions.service';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post('bulk')
  bulkUpload(@Body() dto: BulkUploadQuestionsDto) {
    return this.questionsService.bulkUpload(dto);
  }
}
