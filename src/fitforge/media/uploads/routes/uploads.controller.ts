import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import { ConfirmUploadDto } from '../dto/confirm-upload.dto';
import { PresignedUploadDto } from '../dto/presigned-upload.dto';
import { UploadsService } from '../services/uploads.service';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Generate Cloudflare R2 presigned upload URL' })
  presigned(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PresignedUploadDto,
  ) {
    return this.uploadsService
      .createPresignedUrl(user.userId, dto)
      .then((data) => successResponse(data, 'Presigned URL generated'));
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm upload and save progress photo' })
  confirm(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.uploadsService
      .confirm(user.userId, dto)
      .then((data) => successResponse(data, 'Upload confirmed'));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete uploaded file' })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.uploadsService
      .remove(user.userId, id)
      .then((data) => successResponse(data, 'Upload deleted'));
  }
}
