import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto, TaxonomyQueryDto } from '../dto/taxonomy.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

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

    const items = rows.map(({ _count, ...row }) => ({ ...row, bookCount: _count.books }));

    return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
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

  create(data: CreateCategoryDto) {
    return this.prisma.category.create({ data });
  }

  update(id: string, data: UpdateCategoryDto) {
    return this.prisma.category.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }
}
