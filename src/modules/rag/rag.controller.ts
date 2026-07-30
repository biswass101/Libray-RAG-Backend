import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagConversationsService } from './rag-conversations.service';
import { ChatDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('RAG Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rag')
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly conversationsService: RagConversationsService,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations for current user' })
  async getConversations(@CurrentUser() user: any) {
    return this.conversationsService.getConversations(user.id);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new conversation' })
  async createConversation(
    @CurrentUser() user: any,
    @Body() body: { title: string },
  ) {
    return this.conversationsService.createConversation(user.id, body.title);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a specific conversation' })
  async getConversation(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
  ) {
    return this.conversationsService.getConversation(user.id, conversationId);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  async deleteConversation(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
  ) {
    return this.conversationsService.deleteConversation(user.id, conversationId);
  }

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
  async chat(
    @CurrentUser() user: any,
    @Body() dto: ChatDto & { conversationId?: string },
  ) {
    const answer = await this.ragService.chat(dto.question, dto.history);

    if (dto.conversationId) {
      await this.conversationsService.addMessage(user.id, dto.conversationId, 'user', dto.question);
      await this.conversationsService.addMessage(user.id, dto.conversationId, 'assistant', answer.answer);
    }

    return answer;
  }
}
