import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.check();

    if (result.status === 'error') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
