import { PartialType } from '@nestjs/swagger';
import { CreateMealPlanItemDto } from './create-meal-plan-item.dto';

export class UpdateMealPlanItemDto extends PartialType(CreateMealPlanItemDto) {}
