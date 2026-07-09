import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AddHydrationDto {
  @ApiProperty({ example: 250, description: 'Milliliters to add to today’s intake' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMl: number;
}
