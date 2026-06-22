import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module';
import { PhysiqueGoalsController } from './routes/physique-goals.controller';
import { PhysiqueGoalsService } from './services/physique-goals.service';

@Module({
  imports: [AuthModule],
  controllers: [PhysiqueGoalsController],
  providers: [PhysiqueGoalsService],
  exports: [PhysiqueGoalsService],
})
export class PhysiqueGoalsModule {}
