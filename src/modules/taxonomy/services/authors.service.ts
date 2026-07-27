import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateAuthorDto, UpdateAuthorDto, TaxonomyQueryDto } from '../dto/taxonomy.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthorsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private cacheKey(query: TaxonomyQueryDto) {
    const { search = '', page = 1, pageSize = 10, sortBy = 'name', sortDir = 'asc' } = query;
    return `authors:${search}:${page}:${pageSize}:${sortBy}:${sortDir}`;
  }

  async findAll(query: TaxonomyQueryDto) {
    const key = this.cacheKey(query);
    const cached = await this.cache.get(key);
    if (cached) return cached;

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

    const result = {
      items: rows.map(({ _count, ...row }) => ({ ...row, bookCount: _count.books })),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
    await this.cache.set(key, result, 120_000); // 2 min
    return result;
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
    const result = await this.prisma.author.create({ data });
    await this.invalidate();
    return result;
  }

  async update(id: string, data: UpdateAuthorDto) {
    const result = await this.prisma.author.update({ where: { id }, data });
    await this.invalidate();
    return result;
  }

  async remove(id: string) {
    const result = await this.prisma.author.delete({ where: { id } });
    await this.invalidate();
    return result;
  }

  private async invalidate() {
    // cache-manager v7 (Keyv) doesn't expose pattern-delete; clear() is safe
    // since taxonomy data is small and rarely mutated
    await this.cache.clear();
  }
}
