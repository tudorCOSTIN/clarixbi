import { Module } from '@nestjs/common';
import { BullBoardModule } from './bull-board.module';
// Queues are initialized on import
import './queues.config';

@Module({
  imports: [BullBoardModule],
})
export class SyncModule {}
