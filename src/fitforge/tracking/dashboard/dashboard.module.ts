import { Module } from '@nestjs/common';
import { CheckinsModule } from '../checkins/checkins.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { DashboardRepository } from './repositories/dashboard.repository';
import { DashboardController } from './routes/dashboard.controller';
import { AggregatorService } from './services/dashboard-aggregator.service';
import { DashboardService } from './services/dashboard.service';

@Module({
  imports: [CheckinsModule, ComplianceModule],
  controllers: [DashboardController],
  providers: [DashboardService, AggregatorService, DashboardRepository],
  exports: [DashboardService, AggregatorService],
})
export class DashboardModule {}
