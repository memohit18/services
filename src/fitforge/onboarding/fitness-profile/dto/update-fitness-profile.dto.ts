import { PartialType } from '@nestjs/swagger';
import { CreateFitnessProfileDto } from './create-fitness-profile.dto';

export class UpdateFitnessProfileDto extends PartialType(CreateFitnessProfileDto) {}
