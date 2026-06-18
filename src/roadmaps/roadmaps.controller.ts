import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getRequestMetadata } from '../common/utils/request-metadata.util';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { ListRoadmapsQueryDto } from './dto/list-roadmaps-query.dto';
import { RoadmapsService } from './roadmaps.service';

@Controller('roadmaps')
export class RoadmapsController {
  constructor(private readonly roadmapsService: RoadmapsService) {}

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateRoadmapDto,
    @Req() req: Request,
  ) {
    return this.roadmapsService.create(user.userId, dto, {
      userId: user.userId,
      ...getRequestMetadata(req),
    });
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListRoadmapsQueryDto,
  ) {
    return this.roadmapsService.findAll(user.userId, query);
  }

  @Get('filters')
  getFilters(@CurrentUser() user: CurrentUserPayload) {
    return this.roadmapsService.getFilterSummary(user.userId);
  }
}
