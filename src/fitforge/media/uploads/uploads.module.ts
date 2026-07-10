import { Module } from '@nestjs/common';
import { R2StorageService } from './services/r2-storage.service';
import { UploadsController } from './routes/uploads.controller';
import { UploadsService } from './services/uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, R2StorageService],
  exports: [UploadsService, R2StorageService],
})
export class UploadsModule {}
