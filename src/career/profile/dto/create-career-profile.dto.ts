import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCareerProfileDto {
  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentCompany?: string;

  @ApiPropertyOptional({ example: 'Senior Software Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentRole?: string;

  @ApiProperty({ example: 4.5, description: 'Total years of experience' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(60)
  totalExperience: number;

  @ApiPropertyOptional({ example: 18, description: 'Current CTC in LPA (or local unit)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentCtc?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedMinCtc?: number;

  @ApiPropertyOptional({ example: 28 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedMaxCtc?: number;

  @ApiPropertyOptional({ example: 30, description: 'Notice period in days' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(365)
  noticePeriod?: number;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/example' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'https://github.com/example' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  githubUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.dev' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  portfolioUrl?: string;

  @ApiPropertyOptional({ example: 'Backend engineer focused on NestJS and Postgres.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  summary?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
