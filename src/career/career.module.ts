import { Module } from '@nestjs/common';
import { UploadsModule } from '../fitforge/media/uploads/uploads.module';
import { CareerController } from './career.controller';
import { CareerService } from './career.service';
import { CareerPreferencesController } from './preferences/preferences.controller';
import { CareerPreferencesService } from './preferences/preferences.service';
import { CareerProfileController } from './profile/profile.controller';
import { CareerProfileService } from './profile/profile.service';
import { ResumeParserService } from './resume/parser.service';
import { ResumeController } from './resume/resume.controller';
import { ResumeService } from './resume/resume.service';

@Module({
  imports: [UploadsModule],
  controllers: [
    CareerController,
    CareerProfileController,
    CareerPreferencesController,
    ResumeController,
  ],
  providers: [
    CareerService,
    CareerProfileService,
    CareerPreferencesService,
    ResumeService,
    ResumeParserService,
  ],
  exports: [
    CareerService,
    CareerProfileService,
    CareerPreferencesService,
    ResumeService,
  ],
})
export class CareerModule {}
