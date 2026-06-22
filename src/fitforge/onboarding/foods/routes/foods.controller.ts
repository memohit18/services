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
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { successResponse } from '../../../../common/utils/api-response';
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

  @Post()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create food (admin)' })
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
  @ApiOperation({ summary: 'Search foods' })
  search(@Query() query: ListFoodsQueryDto) {
    return this.foodsService.search(query);
  }
}
