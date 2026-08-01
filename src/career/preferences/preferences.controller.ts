import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response';
import { CreateCareerPreferencesDto } from './dto/create-career-preferences.dto';
import { UpdateCareerPreferencesDto } from './dto/update-career-preferences.dto';
import { CareerPreferencesService } from './preferences.service';

@ApiTags('Career Preferences')
@ApiBearerAuth()
@Controller('career/preferences')
export class CareerPreferencesController {
  constructor(
    private readonly careerPreferencesService: CareerPreferencesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create career preferences' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCareerPreferencesDto,
  ) {
    return this.careerPreferencesService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Career preferences created'));
  }

  @Get()
  @ApiOperation({ summary: 'Get career preferences' })
  get(@CurrentUser() user: CurrentUserPayload) {
    return this.careerPreferencesService
      .get(user.userId)
      .then((data) => successResponse(data));
  }

  @Patch()
  @ApiOperation({ summary: 'Update career preferences' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateCareerPreferencesDto,
  ) {
    return this.careerPreferencesService
      .update(user.userId, dto)
      .then((data) => successResponse(data, 'Career preferences updated'));
  }
}
