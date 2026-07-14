import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ACTIVITY_LOG_MODEL,
  ActivityLogSchema,
} from '../../db-schema/mongodb/schemas/activity-log.schema';
import {
  BOOKMARK_MODEL,
  BookmarkSchema,
} from '../../db-schema/mongodb/schemas/bookmark.schema';
import { NOTE_MODEL, NoteSchema } from '../../db-schema/mongodb/schemas/note.schema';
import {
  EXAMPLE_MODEL,
  ExampleSchema,
} from '../../db-schema/mongodb/schemas/example.schema';
import {
  FOLLOW_UP_MODEL,
  FollowUpSchema,
} from '../../db-schema/mongodb/schemas/follow-up.schema';
import {
  HINT_MODEL,
  HintSchema,
} from '../../db-schema/mongodb/schemas/hint.schema';
import {
  QUESTION_MODEL,
  QuestionSchema,
} from '../../db-schema/mongodb/schemas/question.schema';
import {
  ROADMAP_MODEL,
  RoadmapSchema,
} from '../../db-schema/mongodb/schemas/roadmap.schema';
import {
  ROADMAP_QUESTION_MODEL,
  RoadmapQuestionSchema,
} from '../../db-schema/mongodb/schemas/roadmap-question.schema';
import {
  SUBMISSION_MODEL,
  SubmissionSchema,
} from '../../db-schema/mongodb/schemas/submission.schema';
import {
  TEST_CASE_MODEL,
  TestCaseSchema,
} from '../../db-schema/mongodb/schemas/test-case.schema';
import {
  USER_IMAGE_MODEL,
  UserImageSchema,
} from '../../db-schema/mongodb/schemas/user-image.schema';
import {
  USER_PROGRESS_MODEL,
  UserProgressSchema,
} from '../../db-schema/mongodb/schemas/user-progress.schema';

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
      { name: QUESTION_MODEL, schema: QuestionSchema },
      { name: EXAMPLE_MODEL, schema: ExampleSchema },
      { name: FOLLOW_UP_MODEL, schema: FollowUpSchema },
      { name: HINT_MODEL, schema: HintSchema },
      { name: TEST_CASE_MODEL, schema: TestCaseSchema },
      { name: ROADMAP_MODEL, schema: RoadmapSchema },
      { name: ROADMAP_QUESTION_MODEL, schema: RoadmapQuestionSchema },
      { name: SUBMISSION_MODEL, schema: SubmissionSchema },
      { name: USER_PROGRESS_MODEL, schema: UserProgressSchema },
      { name: USER_IMAGE_MODEL, schema: UserImageSchema },
      { name: NOTE_MODEL, schema: NoteSchema },
      { name: BOOKMARK_MODEL, schema: BookmarkSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongoDBModule {}
