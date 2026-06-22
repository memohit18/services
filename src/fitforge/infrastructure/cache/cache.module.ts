import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module';
import { CacheController } from './routes/cache.controller';

@Module({
  imports: [AuthModule],
  controllers: [CacheController],
})
export class CacheModule {}
