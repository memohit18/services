import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/** FE may send reps as number (10) or string ("8-12" / "10"). */
function toRepsString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value);
}

export class LogWorkoutSetDto {
  @ApiPropertyOptional({
    description: 'Active session id (defaults to current open session)',
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiProperty({
    example: '10',
    description: 'Reps completed for this set (number or string)',
  })
  @Transform(({ value }) => toRepsString(value))
  @IsString()
  @MaxLength(32)
  reps!: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ example: 90, description: 'Rest after this set (seconds)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  restSeconds?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  setNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
