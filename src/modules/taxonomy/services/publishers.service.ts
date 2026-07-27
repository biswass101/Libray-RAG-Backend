import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreatePublisherDto, UpdatePublisherDto, TaxonomyQueryDto } from '../dto/taxonomy.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PublishersService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private cacheKey(query: TaxonomyQueryDto) {
    const { search = '', page = 1, pageSize = 10, sortBy = 'name', sortDir = 'asc' } = query;
    return `publishers:${search}:${page}:${pageSize}:${sortBy}:${sortDir}`;
  }

  async findAll(query: TaxonomyQueryDto) {
    const key = this.cacheKey(query);
    const cached = await this.cache.get(key);
    if (cached) return cached;

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
    const publisher = await this.prisma.publisher.findUnique({
      where: { id },
      include: { _count: { select: { books: true } } },
    });
    if (!publisher) throw new NotFoundException('Publisher not found');
    const { _count, ...row } = publisher;
    return { ...row, bookCount: _count.books };
  }

  async create(data: CreatePublisherDto) {
    const result = await this.prisma.publisher.create({ data });
    await this.invalidate();
    return result;
  }

  async update(id: string, data: UpdatePublisherDto) {
    const result = await this.prisma.publisher.update({ where: { id }, data });
    await this.invalidate();
    return result;
  }

  async remove(id: string) {
    const result = await this.prisma.publisher.delete({ where: { id } });
    await this.invalidate();
    return result;
  }

  private async invalidate() {
    await this.cache.clear();
  }
}
