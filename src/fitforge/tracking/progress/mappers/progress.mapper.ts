import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ProgressLog, ProgressPhoto } from '@prisma/client';

export class ProgressLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  weightKg: number | null;

  @ApiPropertyOptional()
  bodyFatPercentage: number | null;

  @ApiPropertyOptional()
  waistCm: number | null;

  @ApiPropertyOptional()
  chestCm: number | null;

  @ApiPropertyOptional()
  armCm: number | null;

  @ApiPropertyOptional()
  thighCm: number | null;

  @ApiPropertyOptional()
  notes: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class ProgressPhotoResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  frontImageUrl: string | null;

  @ApiPropertyOptional()
  sideImageUrl: string | null;

  @ApiPropertyOptional()
  backImageUrl: string | null;

  @ApiProperty()
  createdAt: Date;
}

export function toProgressLogResponse(log: ProgressLog): ProgressLogResponseDto {
  return {
    id: log.id,
    weightKg: log.weightKg,
    bodyFatPercentage: log.bodyFatPercentage,
    waistCm: log.waistCm,
    chestCm: log.chestCm,
    armCm: log.armCm,
    thighCm: log.thighCm,
    notes: log.notes,
    createdAt: log.createdAt,
  };
}

export function toProgressPhotoResponse(
  photo: ProgressPhoto,
): ProgressPhotoResponseDto {
  return {
    id: photo.id,
    frontImageUrl: photo.frontImageUrl,
    sideImageUrl: photo.sideImageUrl,
    backImageUrl: photo.backImageUrl,
    createdAt: photo.createdAt,
  };
}
