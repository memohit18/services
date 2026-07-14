import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { successResponse } from '../../../../common/utils/api-response';
import { CreateCustomFoodDto } from '../dto/create-custom-food.dto';
import { CreateFoodDto } from '../dto/create-food.dto';
import { FoodResponseDto } from '../dto/food-response.dto';
import { ListFoodsQueryDto } from '../dto/list-foods-query.dto';
import { UpdateFoodDto } from '../dto/update-food.dto';
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

  @Post('custom')
  @ApiOperation({ summary: 'Create a custom food (user-owned)' })
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
  @ApiOperation({ summary: 'Create a verified catalog food (admin)' })
  @ApiResponse({ status: 201, type: FoodResponseDto })
  create(@Body() dto: CreateFoodDto) {
    return this.foodsService
      .createVerified(dto)
      .then((data) => successResponse(data, 'Food created'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get food by ID' })
  @ApiResponse({ status: 200, type: FoodResponseDto })
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.foodsService
      .findById(id, user.userId)
      .then((data) => successResponse(data, 'Food retrieved'));
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update food item (incl. imageUrl). Custom: owner only; catalog: admin only.',
    description:
      'Partial update. Set imageUrl from POST /images. Set category or imageUrl to null to clear.',
  })
  @ApiResponse({ status: 200, type: FoodResponseDto })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateFoodDto,
  ) {
    return this.foodsService
      .update(user.userId, user.role, id, dto)
      .then((data) => successResponse(data, 'Food updated'));
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete food. Custom: owner; catalog: admin. Removes meal-plan usages and rebuilds active plans from remaining foods.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Not allowed' })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.foodsService
      .remove(user.userId, user.role, id)
      .then((data) => successResponse(data, 'Food deleted'));
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
