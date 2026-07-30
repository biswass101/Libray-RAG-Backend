import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class RagConversationsService {
  constructor(private prisma: PrismaService) {}

  async getConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { userId },
      include: { messages: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createConversation(userId: string, title: string) {
    return this.prisma.conversation.create({
      data: {
        userId,
        title,
        messages: {
          create: [],
        },
      },
      include: { messages: true },
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: true },
    });

    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.userId !== userId) throw new NotFoundException('Unauthorized');

    return conv;
  }

  async addMessage(userId: string, conversationId: string, role: string, content: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.userId !== userId) throw new NotFoundException('Unauthorized');

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        messages: {
          create: {
            role,
            content,
          },
        },
        updatedAt: new Date(),
      },
    });

    return this.getConversation(userId, conversationId);
  }

  async deleteConversation(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.userId !== userId) throw new NotFoundException('Unauthorized');

    return this.prisma.conversation.delete({
      where: { id: conversationId },
    });
  }
}
