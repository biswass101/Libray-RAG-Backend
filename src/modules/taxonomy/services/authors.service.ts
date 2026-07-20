import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateAuthorDto, UpdateAuthorDto, TaxonomyQueryDto } from '../dto/taxonomy.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: TaxonomyQueryDto) {
    const { search, page = 1, pageSize = 10, sortBy = 'name', sortDir = 'asc' } = query;

    const where: Prisma.AuthorWhereInput = {
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.author.findMany({
        where,
        include: { _count: { select: { books: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortDir },
      }),
      this.prisma.author.count({ where }),
    ]);

    const items = rows.map(({ _count, ...row }) => ({ ...row, bookCount: _count.books }));

    return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const author = await this.prisma.author.findUnique({
      where: { id },
      include: { _count: { select: { books: true } } },
    });
    if (!author) throw new NotFoundException('Author not found');
    const { _count, ...row } = author;
    return { ...row, bookCount: _count.books };
  }

  create(data: CreateAuthorDto) {
    return this.prisma.author.create({ data });
  }

  update(id: string, data: UpdateAuthorDto) {
    return this.prisma.author.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.author.delete({ where: { id } });
  }
}
