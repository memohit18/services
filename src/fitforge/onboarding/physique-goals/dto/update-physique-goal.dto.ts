import { PartialType } from '@nestjs/swagger';
import { CreatePhysiqueGoalDto } from './create-physique-goal.dto';

export class UpdatePhysiqueGoalDto extends PartialType(CreatePhysiqueGoalDto) {}
