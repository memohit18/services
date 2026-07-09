import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import { CreateNutritionPreferencesDto } from '../dto/create-nutrition-preferences.dto';
import { NutritionPreferencesResponseDto } from '../dto/nutrition-preferences-response.dto';
import { UpdateNutritionPreferencesDto } from '../dto/update-nutrition-preferences.dto';
import { NutritionPreferencesService } from '../services/nutrition-preferences.service';

@ApiTags('Nutrition Preferences')
@ApiBearerAuth()
@Controller('nutrition-preferences')
export class NutritionPreferencesController {
  constructor(
    private readonly nutritionPreferencesService: NutritionPreferencesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user nutrition preferences' })
  @ApiResponse({ status: 200, type: NutritionPreferencesResponseDto })
  get(@CurrentUser() user: CurrentUserPayload) {
    return this.nutritionPreferencesService
      .findByUserId(user.userId)
      .then((data) => successResponse(data, 'Nutrition preferences retrieved successfully'));
  }

  @Post()
  @ApiOperation({ summary: 'Create nutrition preferences' })
  @ApiResponse({ status: 201, type: NutritionPreferencesResponseDto })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateNutritionPreferencesDto,
  ) {
    return this.nutritionPreferencesService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Nutrition preferences saved successfully'));
  }

  @Patch()
  @ApiOperation({ summary: 'Update nutrition preferences' })
  @ApiResponse({ status: 200, type: NutritionPreferencesResponseDto })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateNutritionPreferencesDto,
  ) {
    return this.nutritionPreferencesService
      .update(user.userId, dto)
      .then((data) => successResponse(data, 'Nutrition preferences updated successfully'));
  }

  @Delete()
  @ApiOperation({ summary: 'Delete nutrition preferences' })
  remove(@CurrentUser() user: CurrentUserPayload) {
    return this.nutritionPreferencesService
      .remove(user.userId)
      .then((data) => successResponse(data, 'Nutrition preferences deleted successfully'));
  }
}
