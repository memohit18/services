import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MongoDBModule } from './mongodb/mongodb.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { QuestionsModule } from './questions/questions.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { UserProgressModule } from './user-progress/user-progress.module';
import { RoadmapsModule } from './roadmaps/roadmaps.module';
import { FitforgeModule } from './fitforge/fitforge.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    PrismaModule,
    MongoDBModule,
    AuthModule,
    ActivityLogsModule,
    HealthModule,
    ProfileModule,
    QuestionsModule,
    SubmissionsModule,
    UserProgressModule,
    RoadmapsModule,
    FitforgeModule,
  ],
})
export class AppModule {}
