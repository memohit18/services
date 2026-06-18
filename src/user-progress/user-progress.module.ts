import { Module } from '@nestjs/common';
import { MongoDBModule } from '../mongodb/mongodb.module';
import { UserProgressController } from './user-progress.controller';
import { UserProgressService } from './user-progress.service';

@Module({
  imports: [MongoDBModule],
  controllers: [UserProgressController],
  providers: [UserProgressService],
  exports: [UserProgressService],
})
export class UserProgressModule {}
