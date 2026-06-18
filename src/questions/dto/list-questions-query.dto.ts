import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { QUESTION_DIFFICULTIES } from '../../../db-schema/mongodb/schemas/question.schema';

function toBoolean(value: unknown) {
  if (value === 'true' || value === true) {
    return true;
  }

  if (value === 'false' || value === false) {
    return false;
  }

  return value;
}

export class ListQuestionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(QUESTION_DIFFICULTIES)
  difficulty?: (typeof QUESTION_DIFFICULTIES)[number];

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  roadmapId?: string;

  @IsOptional()
  @IsString()
  roadmap?: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  useActiveRoadmap?: boolean;
}
