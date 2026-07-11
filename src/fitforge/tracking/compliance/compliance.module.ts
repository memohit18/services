import { Module } from '@nestjs/common';
import { CheckinsModule } from '../checkins/checkins.module';
import { ComplianceRepository } from './repositories/compliance.repository';
import { ComplianceService } from './services/compliance.service';

@Module({
  imports: [CheckinsModule],
  providers: [ComplianceService, ComplianceRepository],
  exports: [ComplianceService, ComplianceRepository],
})
export class ComplianceModule {}
