import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateBookDto,
  UpdateBookDto,
  BookQueryDto,
  CreateShelfSlotDto,
  UpdateShelfSlotDto,
} from './dto/book.dto';
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
          shelfSlot: { select: { id: true, code: true, label: true, capacity: true, description: true, active: true } },
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
        shelfSlot: true,
      },
    });
    if (!book) throw new NotFoundException(`Book #${id} not found`);
    return book;
  }

  async create(dto: CreateBookDto) {
    const { availableCopies, shelfSlotId, ...rest } = dto;

    if (shelfSlotId) {
      const slot = await this.prisma.shelfSlot.findUnique({
        where: { id: shelfSlotId },
        include: { books: true },
      });
      if (!slot) throw new NotFoundException(`Shelf slot #${shelfSlotId} not found`);
      if (slot.books.length >= slot.capacity) {
        throw new BadRequestException(`Shelf slot ${slot.code} is at capacity`);
      }
    }

    return this.prisma.book.create({
      data: {
        ...rest,
        shelfSlotId,
        availableCopies: availableCopies ?? dto.totalCopies,
      },
      include: { author: true, category: true, publisher: true },
    });
  }

  async update(id: string, dto: UpdateBookDto) {
    const book = await this.findOne(id);

    if (dto.shelfSlotId && dto.shelfSlotId !== book.shelfSlotId) {
      const slot = await this.prisma.shelfSlot.findUnique({
        where: { id: dto.shelfSlotId },
        include: { books: true },
      });
      if (!slot) throw new NotFoundException(`Shelf slot #${dto.shelfSlotId} not found`);
      const usedSpace = slot.books.filter((b) => b.id !== id).length;
      if (usedSpace >= slot.capacity) {
        throw new BadRequestException(`Shelf slot ${slot.code} is at capacity`);
      }
    }

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

  async listShelfSlots() {
    const slots = await this.prisma.shelfSlot.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
      include: { books: { select: { id: true, title: true, availableCopies: true } } },
    });

    return slots.map((slot) => ({
      ...slot,
      used: slot.books.length,
      available: Math.max(0, slot.capacity - slot.books.length),
    }));
  }

  async createShelfSlot(dto: CreateShelfSlotDto) {
    return this.prisma.shelfSlot.create({ data: dto });
  }

  async updateShelfSlot(id: string, dto: UpdateShelfSlotDto) {
    const slot = await this.prisma.shelfSlot.findUnique({ where: { id } });
    if (!slot) throw new NotFoundException(`Shelf slot #${id} not found`);
    return this.prisma.shelfSlot.update({ where: { id }, data: dto });
  }

  async removeShelfSlot(id: string) {
    const slot = await this.prisma.shelfSlot.findUnique({ where: { id } });
    if (!slot) throw new NotFoundException(`Shelf slot #${id} not found`);
    return this.prisma.shelfSlot.update({ where: { id }, data: { active: false } });
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
