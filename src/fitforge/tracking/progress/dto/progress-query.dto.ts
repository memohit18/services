import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class ProgressHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'ISO date YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-10', description: 'ISO date YYYY-MM-DD (exclusive end)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ProgressAnalyticsQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-10' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ProgressPhotosQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
