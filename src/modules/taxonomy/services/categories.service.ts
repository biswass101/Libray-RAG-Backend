import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto, TaxonomyQueryDto } from '../dto/taxonomy.dto';
import { Prisma } from '@prisma/client';
import { RagService } from '../../rag/rag.service';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private ragService: RagService,
  ) {}

  async findAll(query: TaxonomyQueryDto) {
    const { search, page = 1, pageSize = 10, sortBy = 'name', sortDir = 'asc' } = query;
    const where: Prisma.CategoryWhereInput = {
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: { _count: { select: { books: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortDir },
      }),
      this.prisma.category.count({ where }),
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
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { books: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    const { _count, ...row } = category;
    return { ...row, bookCount: _count.books };
  }

  async create(data: CreateCategoryDto) {
    const category = await this.prisma.category.create({ data });
    this.ragService.embedCategory(category).catch(() => {});
    return category;
  }

  async update(id: string, data: UpdateCategoryDto) {
    const category = await this.prisma.category.update({ where: { id }, data });
    this.ragService.embedCategory(category).catch(() => {});
    return category;
  }

  async remove(id: string) {
    const deleted = await this.prisma.category.delete({ where: { id } });
    this.ragService.removeEntityEmbedding('category', id).catch(() => {});
    return deleted;
  }
}
