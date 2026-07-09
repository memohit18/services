import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { NutritionPreferenceDto } from './nutrition-preference.dto';

export class PatchFoodPreferencesDto {
  @ApiProperty({ type: [String], description: 'Favorite food IDs' })
  @IsArray()
  @IsUUID('4', { each: true })
  favorites: string[];

  @ApiProperty({ type: [String], description: 'Available / willing-to-eat food IDs' })
  @IsArray()
  @IsUUID('4', { each: true })
  available: string[];

  @ApiProperty({ type: [String], description: 'Restricted food IDs' })
  @IsArray()
  @IsUUID('4', { each: true })
  restricted: string[];

  @ApiProperty({ type: [String], description: 'Allergy food IDs' })
  @IsArray()
  @IsUUID('4', { each: true })
  allergies: string[];

  @ApiPropertyOptional({ type: NutritionPreferenceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NutritionPreferenceDto)
  nutrition?: NutritionPreferenceDto;
}
