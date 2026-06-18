import { Module } from '@nestjs/common';
import { MongoDBModule } from '../mongodb/mongodb.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [MongoDBModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
