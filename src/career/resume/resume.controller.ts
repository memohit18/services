import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response';
import { UploadResumeDto } from './dto/upload-resume.dto';
import { ResumeService } from './resume.service';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@ApiTags('Career Resumes')
@ApiBearerAuth()
@Controller('career/resumes')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload resume to R2, persist metadata, and AI-parse skills/experience/education',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        title: {
          type: 'string',
          example: 'Software Engineer Resume',
        },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  upload(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadResumeDto,
  ) {
    return this.resumeService
      .upload(user.userId, file, dto)
      .then((data) => successResponse(data, 'Resume uploaded'));
  }

  @Get()
  @ApiOperation({ summary: 'List resumes for current user' })
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.resumeService
      .list(user.userId)
      .then((data) => successResponse(data));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a resume (R2 object + DB row)' })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resumeService
      .remove(user.userId, id)
      .then((data) => successResponse(data, 'Resume deleted'));
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Mark a resume as the default' })
  setDefault(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resumeService
      .setDefault(user.userId, id)
      .then((data) => successResponse(data, 'Default resume updated'));
  }
}
