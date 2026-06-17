import { Module } from '@nestjs/common';
import { MongoDBModule } from '../mongodb/mongodb.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [MongoDBModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
