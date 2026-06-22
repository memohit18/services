import { Module } from '@nestjs/common';
import { DietController } from './routes/diet.controller';
import { DietService } from './services/diet.service';

@Module({
  controllers: [DietController],
  providers: [DietService],
  exports: [DietService],
})
export class DietModule {}
