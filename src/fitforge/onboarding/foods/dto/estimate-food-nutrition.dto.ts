import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class EstimateFoodNutritionDto {
  @ApiProperty({
    example: 'Rice with daal and bhindi',
    description: 'Free-text description of the food or meal',
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: '1 bowl',
    description: 'Optional serving size hint',
  })
  @IsOptional()
  @IsString()
  servingSize?: string;
}
