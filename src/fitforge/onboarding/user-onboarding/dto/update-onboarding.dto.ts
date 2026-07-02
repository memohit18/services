import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ONBOARDING_STEP_MAX } from '../../../../../db-schema/postgres/constants/fitforge-values';

export class UpdateOnboardingDto {
  @ApiProperty({ example: 2, description: '1-based onboarding step' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ONBOARDING_STEP_MAX)
  currentStep: number;
}
