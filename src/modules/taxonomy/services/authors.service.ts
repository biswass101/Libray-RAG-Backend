import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateAuthorDto, UpdateAuthorDto } from '../dto/taxonomy.dto';

@Injectable()
export class AuthorsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.author.findMany();
  }

  async findOne(id: string) {
    const author = await this.prisma.author.findUnique({ where: { id } });
    if (!author) throw new NotFoundException('Author not found');
    return author;
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
