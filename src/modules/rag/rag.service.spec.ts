import { RagService } from './rag.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('RagService data context', () => {
  it('builds a non-confidential library snapshot', () => {
    const service = new RagService(
      {} as PrismaService,
      { get: jest.fn() } as unknown as ConfigService,
    );

    const context = (service as any).buildDataContext({
      totalBooks: 120,
      availableCopies: 95,
      activeMembers: 87,
      memberStatusBreakdown: [
        { status: 'active', _count: { id: 87 } },
        { status: 'suspended', _count: { id: 5 } },
      ],
      recentBooks: [
        {
          title: 'The Hobbit',
          author: 'J.R.R. Tolkien',
          description: 'A fantasy adventure about a hobbit and a dragon.',
          availableCopies: 3,
          totalCopies: 4,
          shelfLocation: 'A-12',
        },
      ],
    });

    expect(context).toContain('Books in catalog: 120');
    expect(context).toContain('Available copies: 95');
    expect(context).toContain('Active members: 87');
    expect(context).toContain('The Hobbit');
    expect(context).toContain('A fantasy adventure about a hobbit and a dragon.');
    expect(context).not.toContain('email');
  });

  it('includes recent conversation history in the prompt', () => {
    const service = new RagService(
      {} as PrismaService,
      { get: jest.fn() } as unknown as ConfigService,
    );

    const prompt = (service as any).buildPrompt(
      'Describe this book',
      'The Hobbit',
      'Book context',
      [
        { role: 'user', content: 'Tell me about The Hobbit' },
        { role: 'assistant', content: 'The Hobbit is a fantasy adventure about Bilbo Baggins.' },
      ],
    );

    expect(prompt).toContain('Conversation history');
    expect(prompt).toContain('Tell me about The Hobbit');
    expect(prompt).toContain('The Hobbit is a fantasy adventure about Bilbo Baggins.');
  });
});
