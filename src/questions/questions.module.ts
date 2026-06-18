import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MongoDBModule } from '../mongodb/mongodb.module';
import { RoadmapsModule } from '../roadmaps/roadmaps.module';
import { BulkUploadNormalizeMiddleware } from './middleware/bulk-upload-normalize.middleware';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [MongoDBModule, RoadmapsModule],
  controllers: [QuestionsController],
  providers: [QuestionsService, BulkUploadNormalizeMiddleware],
})
export class QuestionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(BulkUploadNormalizeMiddleware)
      .forRoutes({ path: 'questions/bulk', method: RequestMethod.POST });
  }
}
