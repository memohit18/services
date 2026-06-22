import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class BulkFoodPreferencesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  favorites: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  restricted: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  allergies: string[];
}
