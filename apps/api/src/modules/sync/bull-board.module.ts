import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { queues } from './queues.config';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: Object.values(queues).map((q) => new BullMQAdapter(q)),
  serverAdapter,
});

@Module({})
export class BullBoardModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(serverAdapter.getRouter()).forRoutes('/admin/queues');
  }
}
