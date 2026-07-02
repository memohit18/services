import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { successResponse } from '../../../../common/utils/api-response';
import { CreateCustomFoodDto } from '../dto/create-custom-food.dto';
import { CreateFoodDto } from '../dto/create-food.dto';
import { FoodResponseDto } from '../dto/food-response.dto';
import { ListFoodsQueryDto } from '../dto/list-foods-query.dto';
import { UpdateFoodDto } from '../dto/update-food.dto';
import { FoodsService } from '../services/foods.service';

@ApiTags('Food Catalog')
@ApiBearerAuth()
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Post('custom')
  @ApiOperation({ summary: 'Create custom food (user-owned, unverified)' })
  @ApiResponse({ status: 201, type: FoodResponseDto })
  createCustom(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCustomFoodDto,
  ) {
    return this.foodsService
      .createCustom(user.userId, dto)
      .then((data) => successResponse(data, 'Custom food created'));
  }

  @Post()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create verified food (admin)' })
  @ApiResponse({ status: 201, type: FoodResponseDto })
  create(@Body() dto: CreateFoodDto) {
    return this.foodsService.create(dto).then((data) => successResponse(data, 'Food created'));
  }

  @Put(':id')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update food (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateFoodDto) {
    return this.foodsService.update(id, dto).then((data) => successResponse(data, 'Food updated'));
  }

  @Delete(':id')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete food (admin)' })
  remove(@Param('id') id: string) {
    return this.foodsService.remove(id).then((data) => successResponse(data, 'Food deleted'));
  }

  @Get()
  @ApiOperation({ summary: 'Search verified foods and your custom foods' })
  search(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListFoodsQueryDto,
  ) {
    return this.foodsService.search(user.userId, query);
  }
}
