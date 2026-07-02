import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../../ai/generation/ai-generation.module';
import { DietController } from './routes/diet.controller';
import { DietService } from './services/diet.service';

@Module({
  imports: [AiGenerationModule],
  controllers: [DietController],
  providers: [DietService],
  exports: [DietService],
})
export class DietModule {}
