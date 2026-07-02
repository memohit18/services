import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  QUESTION_DIFFICULTIES,
  QUESTION_OUTPUT_TYPES,
} from '../../../db-schema/mongodb/schemas/question.schema';
import { TEST_CASE_VALIDATION_TYPES } from '../../../db-schema/mongodb/schemas/test-case.schema';
import { TestCaseOutputRuleConstraint } from '../validators/testcase-output.validator';

export class QuestionExampleDto {
  @IsDefined()
  input: Record<string, unknown>;

  @IsDefined()
  output: unknown;

  @IsOptional()
  @IsString()
  explanation?: string;
}

export class QuestionItemDto {
  @IsInt()
  @Min(1)
  questionId: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  pattern: string;

  @IsIn(QUESTION_DIFFICULTIES)
  difficulty: (typeof QUESTION_DIFFICULTIES)[number];

  @IsString()
  @IsNotEmpty()
  problemStatement: string;

  @IsArray()
  @IsString({ each: true })
  constraints: string[];

  @IsOptional()
  @IsString()
  expectedTimeComplexity?: string;

  @IsOptional()
  @IsString()
  expectedSpaceComplexity?: string;

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsOptional()
  @IsIn(QUESTION_OUTPUT_TYPES)
  outputType?: (typeof QUESTION_OUTPUT_TYPES)[number];

  @IsOptional()
  @IsInt()
  @Min(100)
  timeLimitMs?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionExampleDto)
  examples?: QuestionExampleDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hints?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  followUps?: string[];
}

export class TestCaseItemDto {
  @IsInt()
  @Min(1)
  questionId: number;

  @IsDefined()
  @Validate(TestCaseOutputRuleConstraint)
  input: unknown;

  @IsOptional()
  @IsIn(TEST_CASE_VALIDATION_TYPES)
  validationType?: (typeof TEST_CASE_VALIDATION_TYPES)[number];

  @IsOptional()
  expectedOutput?: unknown;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedOutputCount?: number;

  @IsOptional()
  @IsBoolean()
  isSample?: boolean;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  weight?: number;
}

export class BulkUploadQuestionsDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionItemDto)
  questions?: QuestionItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TestCaseItemDto)
  testcases?: TestCaseItemDto[];
}
