import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response';
import { CreateCareerProfileDto } from './dto/create-career-profile.dto';
import { UpdateCareerProfileDto } from './dto/update-career-profile.dto';
import { CareerProfileService } from './profile.service';

@ApiTags('Career Profile')
@ApiBearerAuth()
@Controller('career/profile')
export class CareerProfileController {
  constructor(private readonly careerProfileService: CareerProfileService) {}

  @Post()
  @ApiOperation({ summary: 'Create career profile' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCareerProfileDto,
  ) {
    return this.careerProfileService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Career profile created'));
  }

  @Get()
  @ApiOperation({ summary: 'Get career profile' })
  get(@CurrentUser() user: CurrentUserPayload) {
    return this.careerProfileService
      .get(user.userId)
      .then((data) => successResponse(data));
  }

  @Patch()
  @ApiOperation({ summary: 'Update career profile' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateCareerProfileDto,
  ) {
    return this.careerProfileService
      .update(user.userId, dto)
      .then((data) => successResponse(data, 'Career profile updated'));
  }
}
