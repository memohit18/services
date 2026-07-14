import { Module } from '@nestjs/common';
import { MongoDBModule } from '../../../mongodb/mongodb.module';
import { UploadsModule } from '../uploads/uploads.module';
import { UserImageRepository } from './repositories/user-image.repository';
import { ImagesController } from './routes/images.controller';
import { ImageOptimizeService } from './services/image-optimize.service';
import { ImagesService } from './services/images.service';

@Module({
  imports: [MongoDBModule, UploadsModule],
  controllers: [ImagesController],
  providers: [ImagesService, ImageOptimizeService, UserImageRepository],
  exports: [ImagesService],
})
export class ImagesModule {}
