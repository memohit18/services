import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { successResponse } from '../../../../common/utils/api-response';
import { CreateDietDto } from '../dto/create-diet.dto';
import { DietService } from '../services/diet.service';

@ApiTags('Diet')
@ApiBearerAuth()
@Controller('diet')
export class DietController {
  constructor(private readonly dietService: DietService) {}

  @Post()
  @ApiOperation({ summary: 'Create diet plan version' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateDietDto,
  ) {
    return this.dietService
      .create(user.userId, dto)
      .then((data) => successResponse(data, 'Diet plan created'));
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active diet plan' })
  getActive(@CurrentUser() user: CurrentUserPayload) {
    return this.dietService.getActive(user.userId).then((data) => successResponse(data));
  }

  @Get('history')
  @ApiOperation({ summary: 'Get diet plan history' })
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.dietService.getHistory(user.userId, query);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate diet plan version' })
  activate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.dietService
      .activate(user.userId, id)
      .then((data) => successResponse(data, 'Diet plan activated'));
  }
}
