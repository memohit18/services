import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { successResponse } from '../../../../common/utils/api-response';
import { CreatePhysiqueGoalDto } from '../dto/create-physique-goal.dto';
import { PhysiqueGoalResponseDto } from '../dto/physique-goal-response.dto';
import { PhysiqueGoalsService } from '../services/physique-goals.service';

@ApiTags('Physique Goals')
@ApiBearerAuth()
@Controller('physique-goals')
export class PhysiqueGoalsController {
  constructor(private readonly physiqueGoalsService: PhysiqueGoalsService) {}

  @Post()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create physique goal (admin)' })
  @ApiResponse({ status: 201, type: PhysiqueGoalResponseDto })
  create(@Body() dto: CreatePhysiqueGoalDto) {
    return this.physiqueGoalsService
      .create(dto)
      .then((data) => successResponse(data, 'Physique goal created'));
  }

  @Get()
  @ApiOperation({ summary: 'List physique goals' })
  @ApiResponse({ status: 200, type: [PhysiqueGoalResponseDto] })
  findAll() {
    return this.physiqueGoalsService.findAll().then((data) => successResponse(data));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get physique goal by id' })
  @ApiResponse({ status: 200, type: PhysiqueGoalResponseDto })
  findOne(@Param('id') id: string) {
    return this.physiqueGoalsService.findOne(id).then((data) => successResponse(data));
  }
}
