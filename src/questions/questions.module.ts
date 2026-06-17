import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MongoDBModule } from '../mongodb/mongodb.module';
import { BulkUploadNormalizeMiddleware } from './middleware/bulk-upload-normalize.middleware';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [MongoDBModule],
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
