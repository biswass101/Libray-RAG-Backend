import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagConversationsService } from './rag-conversations.service';
import { RagController } from './rag.controller';

@Module({
  controllers: [RagController],
  providers: [RagService, RagConversationsService],
  exports: [RagService, RagConversationsService],
})
export class RagModule {}
