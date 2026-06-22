import { Controller, Delete, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { successResponse } from '../../../../common/utils/api-response';
import { RedisService } from '../../redis/redis.service';

@ApiTags('Cache')
@ApiBearerAuth()
@Controller('cache')
export class CacheController {
  constructor(private readonly redis: RedisService) {}

  @Delete('me')
  @ApiOperation({ summary: 'Clear FitForge cache for current user' })
  clearMine(@CurrentUser() user: CurrentUserPayload) {
    return this.redis
      .clearUserFitForgeCache(user.userId)
      .then(() => successResponse({ cleared: true }, 'User cache cleared'));
  }

  @Post('clear-all')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Clear all FitForge Redis cache (admin)' })
  clearAll() {
    return this.redis.clearAllFitForgeCache().then((count) =>
      successResponse({ keysCleared: count }, 'All FitForge cache cleared'),
    );
  }
}
