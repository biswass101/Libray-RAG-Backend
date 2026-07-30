import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateAuthorDto, UpdateAuthorDto, TaxonomyQueryDto } from '../dto/taxonomy.dto';
import { Prisma } from '@prisma/client';
import { RagService } from '../../rag/rag.service';

@Injectable()
export class AuthorsService {
  constructor(
    private prisma: PrismaService,
    private ragService: RagService,
  ) {}

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

    return {
      items: rows.map(({ _count, ...row }) => ({ ...row, bookCount: _count.books })),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
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

  async create(data: CreateAuthorDto) {
    const author = await this.prisma.author.create({ data });
    this.ragService.embedAuthor(author).catch(() => {});
    return author;
  }

  async update(id: string, data: UpdateAuthorDto) {
    const author = await this.prisma.author.update({ where: { id }, data });
    this.ragService.embedAuthor(author).catch(() => {});
    return author;
  }

  async remove(id: string) {
    const deleted = await this.prisma.author.delete({ where: { id } });
    this.ragService.removeEntityEmbedding('author', id).catch(() => {});
    return deleted;
  }
}
