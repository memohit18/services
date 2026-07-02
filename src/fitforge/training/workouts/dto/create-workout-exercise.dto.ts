import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateWorkoutExerciseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  exerciseId: string;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sets: number;

  @ApiProperty({ example: '8-12' })
  @IsString()
  @MinLength(1)
  reps: string;

  @ApiProperty({ example: 90 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  restSeconds: number;
}
