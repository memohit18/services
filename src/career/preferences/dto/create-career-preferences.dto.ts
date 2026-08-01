import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EMPLOYMENT_TYPES, WORK_MODES } from '../../types/career.types';

export class CreateCareerPreferencesDto {
  @ApiProperty({ example: ['Backend Engineer', 'Full Stack Developer'] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  preferredRoles: string[];

  @ApiProperty({ example: ['Bangalore', 'Remote'] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  preferredLocations: string[];

  @ApiProperty({ example: ['full_time'], enum: EMPLOYMENT_TYPES, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsIn(EMPLOYMENT_TYPES, { each: true })
  employmentTypes: string[];

  @ApiProperty({ example: ['remote', 'hybrid'], enum: WORK_MODES, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsIn(WORK_MODES, { each: true })
  workModes: string[];

  @ApiProperty({ example: ['NestJS', 'PostgreSQL', 'TypeScript'] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  preferredSkills: string[];

  @ApiPropertyOptional({ example: ['Google', 'Stripe'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  preferredCompanies?: string[];

  @ApiPropertyOptional({ example: ['Acme BadCorp'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  blockedCompanies?: string[];

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSalary?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxSalary?: number;

  @ApiPropertyOptional({ example: ['nestjs', 'backend'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  searchKeywords?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  autoApply?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
