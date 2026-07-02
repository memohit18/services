import { Module } from '@nestjs/common';
import { MongoDBModule } from '../mongodb/mongodb.module';
import { UserProgressModule } from '../user-progress/user-progress.module';
import { CodeJudgeService } from './judging/code-judge.service';
import { CodeRunnerService } from './judging/code-runner.service';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [MongoDBModule, UserProgressModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, CodeRunnerService, CodeJudgeService],
})
export class SubmissionsModule {}
