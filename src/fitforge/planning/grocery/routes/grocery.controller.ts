import { Controller, Get, Post, Query } from '@nestjs/common';
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
import { GroceryService } from '../services/grocery.service';

@ApiTags('Grocery')
@ApiBearerAuth()
@Controller('grocery')
export class GroceryController {
  constructor(private readonly groceryService: GroceryService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate grocery list from active meal plan' })
  generate(@CurrentUser() user: CurrentUserPayload) {
    return this.groceryService
      .generate(user.userId)
      .then((data) => successResponse(data, 'Grocery list generated'));
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current grocery list' })
  getCurrent(@CurrentUser() user: CurrentUserPayload) {
    return this.groceryService
      .getCurrent(user.userId)
      .then((data) => successResponse(data));
  }

  @Get('history')
  @ApiOperation({ summary: 'Get grocery list history' })
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.groceryService.getHistory(user.userId, query);
  }
}
