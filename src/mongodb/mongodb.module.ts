import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ACTIVITY_LOG_MODEL,
  ActivityLogSchema,
} from '../../db-schema/mongodb/schemas/activity-log.schema';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URL');
        if (!uri) {
          throw new Error('MONGODB_URL is not configured');
        }
        return { uri };
      },
    }),
    MongooseModule.forFeature([
      { name: ACTIVITY_LOG_MODEL, schema: ActivityLogSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongoDBModule {}
