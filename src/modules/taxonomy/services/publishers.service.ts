import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreatePublisherDto, UpdatePublisherDto } from '../dto/taxonomy.dto';

@Injectable()
export class PublishersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.publisher.findMany();
  }

  async findOne(id: string) {
    const publisher = await this.prisma.publisher.findUnique({ where: { id } });
    if (!publisher) throw new NotFoundException('Publisher not found');
    return publisher;
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
