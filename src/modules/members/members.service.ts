import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMemberDto, UpdateMemberDto, MemberQueryDto } from './dto/member.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: MemberQueryDto) {
    const {
      search, status, plan,
      page = 1, pageSize = 10, sortBy = 'createdAt', sortDir = 'desc'
    } = query;

    const where: Prisma.MemberWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status && { status }),
      ...(plan && { plan }),
    };

    const [items, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortDir },
      }),
      this.prisma.member.count({ where }),
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
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException(`Member #${id} not found`);
    return member;
  }

  async create(dto: CreateMemberDto) {
    const existing = await this.prisma.member.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    return this.prisma.member.create({
      data: {
        ...dto,
        expiresAt: new Date(dto.expiresAt),
      },
    });
  }

  async update(id: string, dto: UpdateMemberDto) {
    await this.findOne(id);
    return this.prisma.member.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.expiresAt && { expiresAt: new Date(dto.expiresAt) }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.member.delete({ where: { id } });
  }

  async getBorrowHistory(id: string) {
    await this.findOne(id);
    return this.prisma.borrow.findMany({
      where: { memberId: id },
      include: { book: { select: { id: true, title: true, isbn: true } } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getFineHistory(id: string) {
    await this.findOne(id);
    return this.prisma.fine.findMany({
      where: { memberId: id },
      include: {
        borrow: { include: { book: { select: { id: true, title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
