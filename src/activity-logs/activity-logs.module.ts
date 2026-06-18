import { Global, Module } from '@nestjs/common';
import { MongoDBModule } from '../mongodb/mongodb.module';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';

@Global()
@Module({
  imports: [MongoDBModule],
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService],
})
export class ActivityLogsModule {}
