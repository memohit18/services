import { Module } from '@nestjs/common';
import { AiContextService } from './ai-context.service';

@Module({
  providers: [AiContextService],
  exports: [AiContextService],
})
export class AiSharedModule {}
