import { PartialType } from '@nestjs/swagger';
import { CreateCareerProfileDto } from './create-career-profile.dto';

export class UpdateCareerProfileDto extends PartialType(CreateCareerProfileDto) {}
