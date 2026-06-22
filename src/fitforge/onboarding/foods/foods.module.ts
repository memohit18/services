import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module';
import { FoodsController } from './routes/foods.controller';
import { FoodsService } from './services/foods.service';

@Module({
  imports: [AuthModule],
  controllers: [FoodsController],
  providers: [FoodsService],
  exports: [FoodsService],
})
export class FoodsModule {}
