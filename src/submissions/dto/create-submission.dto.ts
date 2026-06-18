import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SUBMISSION_STATUSES } from '../../../db-schema/mongodb/schemas/submission.schema';

export class CreateSubmissionDto {
  @IsString()
  @IsNotEmpty()
  language: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsIn(SUBMISSION_STATUSES)
  status?: (typeof SUBMISSION_STATUSES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  passedTestCases?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalTestCases?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  executionTime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  memoryUsed?: number;
}
