import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { RagService } from './rag.service';
import { ChatDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('RAG Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat with the AI using indexed library documents as context' })
  @ApiResponse({
    status: 200,
    description: 'AI answer with source document references',
    schema: {
      properties: {
        answer: { type: 'string' },
        sources: {
          type: 'array',
          items: {
            properties: {
              documentId: { type: 'string' },
              documentName: { type: 'string' },
              snippet: { type: 'string' },
              page: { type: 'number' },
              score: { type: 'number' },
            },
          },
        },
      },
    },
  })
  chat(@Body() dto: ChatDto) {
    return this.ragService.chat(dto.question);
  }
}
