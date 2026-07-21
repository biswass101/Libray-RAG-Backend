import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBookDto, UpdateBookDto, BookQueryDto } from './dto/book.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BooksService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: BookQueryDto) {
    const {
      search, categoryId, authorId, status,
      page = 1, pageSize = 10, sortBy = 'createdAt', sortDir = 'desc'
    } = query;

    const where: Prisma.BookWhereInput = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { isbn: { contains: search, mode: 'insensitive' } },
          { author: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(authorId && { authorId }),
      ...(status === 'available' && { availableCopies: { gt: 0 } }),
      ...(status === 'unavailable' && { availableCopies: 0 }),
    };

    const [items, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        include: {
          author: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          publisher: { select: { id: true, name: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortDir },
      }),
      this.prisma.book.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: {
        author: true,
        category: true,
        publisher: true,
      },
    });
    if (!book) throw new NotFoundException(`Book #${id} not found`);
    return book;
  }

  async create(dto: CreateBookDto) {
    const { availableCopies, ...rest } = dto;
    return this.prisma.book.create({
      data: {
        ...rest,
        availableCopies: availableCopies ?? dto.totalCopies,
      },
      include: { author: true, category: true, publisher: true },
    });
  }

  async update(id: string, dto: UpdateBookDto) {
    await this.findOne(id);
    return this.prisma.book.update({
      where: { id },
      data: dto,
      include: { author: true, category: true, publisher: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.book.delete({ where: { id } });
  }

  async getBorrowHistory(id: string) {
    await this.findOne(id);
    return this.prisma.borrow.findMany({
      where: { bookId: id },
      include: { member: { select: { id: true, name: true, email: true } } },
      orderBy: { issuedAt: 'desc' },
      take: 20,
    });
  }
}
