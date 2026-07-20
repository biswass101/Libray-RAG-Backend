import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreatePublisherDto, UpdatePublisherDto, TaxonomyQueryDto } from '../dto/taxonomy.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PublishersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: TaxonomyQueryDto) {
    const { search, page = 1, pageSize = 10, sortBy = 'name', sortDir = 'asc' } = query;

    const where: Prisma.PublisherWhereInput = {
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.publisher.findMany({
        where,
        include: { _count: { select: { books: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortDir },
      }),
      this.prisma.publisher.count({ where }),
    ]);

    const items = rows.map(({ _count, ...row }) => ({ ...row, bookCount: _count.books }));

    return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const publisher = await this.prisma.publisher.findUnique({
      where: { id },
      include: { _count: { select: { books: true } } },
    });
    if (!publisher) throw new NotFoundException('Publisher not found');
    const { _count, ...row } = publisher;
    return { ...row, bookCount: _count.books };
  }

  create(data: CreatePublisherDto) {
    return this.prisma.publisher.create({ data });
  }

  update(id: string, data: UpdatePublisherDto) {
    return this.prisma.publisher.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.publisher.delete({ where: { id } });
  }
}
