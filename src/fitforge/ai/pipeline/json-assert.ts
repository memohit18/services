import { BadRequestException } from '@nestjs/common';

export function assertObject(
  value: unknown,
  label = 'AI response',
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

export function assertArray(
  value: unknown,
  label: string,
): unknown[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${label} must be an array`);
  }
  return value;
}

export function assertNonEmptyArray(
  value: unknown,
  label: string,
): unknown[] {
  const arr = assertArray(value, label);
  if (arr.length === 0) {
    throw new BadRequestException(`${label} must not be empty`);
  }
  return arr;
}

export function assertNumber(
  value: unknown,
  label: string,
  options?: { min?: number; max?: number; integer?: boolean },
): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new BadRequestException(`${label} must be a finite number`);
  }
  if (options?.integer && !Number.isInteger(value)) {
    throw new BadRequestException(`${label} must be an integer`);
  }
  if (options?.min != null && value < options.min) {
    throw new BadRequestException(`${label} must be >= ${options.min}`);
  }
  if (options?.max != null && value > options.max) {
    throw new BadRequestException(`${label} must be <= ${options.max}`);
  }
  return value;
}

export function assertString(
  value: unknown,
  label: string,
  options?: { minLength?: number },
): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (options?.minLength != null && trimmed.length < options.minLength) {
    throw new BadRequestException(
      `${label} must be at least ${options.minLength} characters`,
    );
  }
  return trimmed;
}

export function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
