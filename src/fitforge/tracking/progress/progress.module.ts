import { Module } from '@nestjs/common';
import { UploadsModule } from '../../media/uploads/uploads.module';
import { CheckinsModule } from '../checkins/checkins.module';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { PhotoRepository } from './repositories/photo.repository';
import { ProgressRepository } from './repositories/progress.repository';
import { ProgressController } from './routes/progress.controller';
import { ProgressService } from './services/progress.service';

@Module({
  imports: [UploadsModule, CheckinsModule],
  controllers: [ProgressController],
  providers: [
    ProgressService,
    ProgressRepository,
    PhotoRepository,
    AnalyticsRepository,
  ],
  exports: [ProgressService],
})
export class ProgressModule {}
