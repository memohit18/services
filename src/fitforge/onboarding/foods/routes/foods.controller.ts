import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { successResponse } from '../../../../common/utils/api-response';
import { FoodResponseDto } from '../dto/food-response.dto';
import { ListFoodsQueryDto } from '../dto/list-foods-query.dto';
import { FoodsService } from '../services/foods.service';

@ApiTags('Foods')
@ApiBearerAuth()
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List food categories' })
  categories() {
    return this.foodsService
      .getCategories()
      .then((data) => successResponse(data, 'Food categories retrieved'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get food by ID' })
  @ApiResponse({ status: 200, type: FoodResponseDto })
  findOne(@Param('id') id: string) {
    return this.foodsService
      .findById(id)
      .then((data) => successResponse(data, 'Food retrieved'));
  }

  @Get()
  @ApiOperation({ summary: 'Search foods with pagination and filters' })
  search(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListFoodsQueryDto,
  ) {
    return this.foodsService.findAll(user.userId, query);
  }
}
