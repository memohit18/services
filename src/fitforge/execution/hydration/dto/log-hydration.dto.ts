import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class LogHydrationDto {
  @ApiProperty({ example: 250 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMl!: number;
}
