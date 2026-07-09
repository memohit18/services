import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { CreateFoodPreferenceDto } from '../dto/create-food-preference.dto';
import { FoodPreferenceResponseDto } from '../dto/food-preference-response.dto';
import { PatchFoodPreferencesDto } from '../dto/patch-food-preferences.dto';
import { FoodPreferencesService } from '../services/food-preferences.service';

@ApiTags('Food Preferences')
@ApiBearerAuth()
@Controller('food-preferences')
export class FoodPreferencesController {
  constructor(private readonly foodPreferencesService: FoodPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get food and nutrition preferences' })
  get(@CurrentUser() user: CurrentUserPayload) {
    return this.foodPreferencesService
      .getPreferences(user.userId)
      .then((data) => successResponse(data, 'Food preferences retrieved'));
  }

  @Post()
  @ApiOperation({ summary: 'Add or update a single food preference' })
  @ApiResponse({ status: 201, type: FoodPreferenceResponseDto })
  add(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateFoodPreferenceDto,
  ) {
    return this.foodPreferencesService
      .add(user.userId, dto)
      .then((data) => successResponse(data, 'Preference saved'));
  }

  @Patch()
  @ApiOperation({ summary: 'Replace all food preferences (transactional)' })
  replace(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PatchFoodPreferencesDto,
  ) {
    return this.foodPreferencesService
      .replace(user.userId, dto)
      .then((data) =>
        successResponse(data, 'Food preferences saved successfully'),
      );
  }

  @Delete(':foodId')
  @ApiOperation({ summary: 'Remove a food from preferences' })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('foodId') foodId: string,
  ) {
    return this.foodPreferencesService
      .removeByFoodId(user.userId, foodId)
      .then((data) => successResponse(data, 'Preference removed'));
  }
}
