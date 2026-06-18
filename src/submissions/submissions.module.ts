import { Module } from '@nestjs/common';
import { MongoDBModule } from '../mongodb/mongodb.module';
import { UserProgressModule } from '../user-progress/user-progress.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [MongoDBModule, UserProgressModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
