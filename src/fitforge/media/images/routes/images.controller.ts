import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
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
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import { ListImagesQueryDto, UploadImageDto } from '../dto/upload-image.dto';
import { ImagesService } from '../services/images.service';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

@ApiTags('Images (R2 + Mongo)')
@ApiBearerAuth()
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Upload image → optimize → multi-size WebP/JPEG/AVIF → Cloudflare R2 → MongoDB',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type'],
      properties: {
        type: {
          type: 'string',
          example: 'profile',
          description: 'Free-form: food | profile | progress | …',
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
    @Body() dto: UploadImageDto,
  ) {
    return this.imagesService
      .upload(user.userId, dto.type, file)
      .then((data) => successResponse(data, 'Image uploaded'));
  }

  @Get()
  @ApiOperation({
    summary: 'List all images for the authenticated user (optional ?type=)',
  })
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListImagesQueryDto,
  ) {
    return this.imagesService.list(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one image by id' })
  getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.imagesService
      .getOne(user.userId, id)
      .then((data) => successResponse(data));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete image from R2 + MongoDB' })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.imagesService
      .remove(user.userId, id)
      .then((data) => successResponse(data, 'Image deleted'));
  }
}
