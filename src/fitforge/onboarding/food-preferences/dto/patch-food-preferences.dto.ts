import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class PatchFoodPreferencesDto {
  @ApiProperty({ type: [String], description: 'Favorite food IDs' })
  @IsArray()
  @IsUUID('4', { each: true })
  favorites: string[];

  @ApiProperty({ type: [String], description: 'Available food IDs' })
  @IsArray()
  @IsUUID('4', { each: true })
  available: string[];

  @ApiProperty({ type: [String], description: 'Restricted food IDs' })
  @IsArray()
  @IsUUID('4', { each: true })
  restricted: string[];
}
