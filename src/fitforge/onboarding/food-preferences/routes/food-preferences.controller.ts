import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { BulkFoodPreferencesDto } from '../dto/bulk-food-preferences.dto';
import { CreateFoodPreferenceDto } from '../dto/create-food-preference.dto';
import { FoodPreferenceResponseDto } from '../dto/food-preference-response.dto';
import { FoodPreferencesService } from '../services/food-preferences.service';

@ApiTags('Food Preferences')
@ApiBearerAuth()
@Controller('food-preferences')
export class FoodPreferencesController {
  constructor(private readonly foodPreferencesService: FoodPreferencesService) {}

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk save food preferences' })
  bulk(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BulkFoodPreferencesDto,
  ) {
    return this.foodPreferencesService
      .bulkSave(user.userId, dto)
      .then((data) => successResponse(data, 'Preferences saved'));
  }

  @Post()
  @ApiOperation({ summary: 'Add food preference' })
  @ApiResponse({ status: 201, type: FoodPreferenceResponseDto })
  add(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateFoodPreferenceDto,
  ) {
    return this.foodPreferencesService
      .add(user.userId, dto)
      .then((data) => successResponse(data, 'Preference added'));
  }

  @Get()
  @ApiOperation({ summary: 'Get food preferences' })
  get(@CurrentUser() user: CurrentUserPayload) {
    return this.foodPreferencesService
      .findAll(user.userId)
      .then((data) => successResponse(data));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete food preference' })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.foodPreferencesService
      .remove(user.userId, id)
      .then((data) => successResponse(data, 'Preference deleted'));
  }
}
