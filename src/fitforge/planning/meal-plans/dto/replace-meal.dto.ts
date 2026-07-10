import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class ReplaceMealDto {
  @ApiProperty({ format: 'uuid', description: 'Replacement FoodMaster id' })
  @IsUUID()
  foodId: string;

  @ApiPropertyOptional({ example: 1, description: 'Servings (default 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.25)
  quantity?: number;
}
