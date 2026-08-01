import { PartialType } from '@nestjs/swagger';
import { CreateCareerPreferencesDto } from './create-career-preferences.dto';

export class UpdateCareerPreferencesDto extends PartialType(
  CreateCareerPreferencesDto,
) {}
