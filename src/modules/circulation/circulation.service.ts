import {
  Injectable, NotFoundException, BadRequestException, ConflictException
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  IssueBorrowDto, ReturnBorrowDto, CreateReservationDto,
  UpdateReservationStatusDto, SettleFineDto, CirculationQueryDto
} from './dto/circulation.dto';
import { Prisma } from '@prisma/client';

const FINE_PER_DAY = 0.5; // $0.50 per day overdue
const MAX_RENEWALS = 2;

@Injectable()
export class CirculationService {
  constructor(private prisma: PrismaService) {}

  // ─── BORROWS ──────────────────────────────────────────────────────────────

  async findAllBorrows(query: CirculationQueryDto) {
    const { search, status, memberId, bookId, page = 1, pageSize = 10, sortBy = 'issuedAt', sortDir = 'desc' } = query;

    const where: Prisma.BorrowWhereInput = {
      ...(memberId && { memberId }),
      ...(bookId && { bookId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { book: { title: { contains: search, mode: 'insensitive' } } },
          { member: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.borrow.findMany({
        where,
        include: {
          book: { select: { id: true, title: true, isbn: true, coverColor: true } },
          member: { select: { id: true, name: true, email: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortDir },
      }),
      this.prisma.borrow.count({ where }),
    ]);

    return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  }

  async issueBorrow(dto: IssueBorrowDto) {
    const [book, member] = await Promise.all([
      this.prisma.book.findUnique({ where: { id: dto.bookId } }),
      this.prisma.member.findUnique({ where: { id: dto.memberId } }),
    ]);

    if (!book) throw new NotFoundException('Book not found');
    if (!member) throw new NotFoundException('Member not found');
    if (book.availableCopies <= 0) throw new BadRequestException('No available copies of this book');
    if (member.status !== 'active') throw new BadRequestException('Member account is not active');

    const [borrow] = await this.prisma.$transaction([
      this.prisma.borrow.create({
        data: {
          bookId: dto.bookId,
          memberId: dto.memberId,
          dueAt: new Date(dto.dueAt),
          status: 'borrowed',
        },
        include: {
          book: { select: { id: true, title: true, isbn: true } },
          member: { select: { id: true, name: true } },
        },
      }),
      this.prisma.book.update({
        where: { id: dto.bookId },
        data: { availableCopies: { decrement: 1 }, borrowCount: { increment: 1 } },
      }),
      this.prisma.member.update({
        where: { id: dto.memberId },
        data: { activeBorrows: { increment: 1 }, totalBorrows: { increment: 1 } },
      }),
    ]);

    return borrow;
  }

  async returnBorrow(id: string) {
    const borrow = await this.prisma.borrow.findUnique({
      where: { id },
      include: { book: true, member: true },
    });
    if (!borrow) throw new NotFoundException('Borrow record not found');
    if (borrow.returnedAt) throw new BadRequestException('Book already returned');

    const now = new Date();
    const dueDate = new Date(borrow.dueAt);
    let fineAmount = 0;
    let status = 'returned';

    if (now > dueDate) {
      const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      fineAmount = daysOverdue * FINE_PER_DAY;
    }

    const ops: any[] = [
      this.prisma.borrow.update({
        where: { id },
        data: { returnedAt: now, status, fineAmount },
      }),
      this.prisma.book.update({
        where: { id: borrow.bookId },
        data: { availableCopies: { increment: 1 } },
      }),
      this.prisma.member.update({
        where: { id: borrow.memberId },
        data: { activeBorrows: { decrement: 1 } },
      }),
    ];

    if (fineAmount > 0) {
      ops.push(
        this.prisma.fine.create({
          data: {
            borrowId: id,
            memberId: borrow.memberId,
            amount: fineAmount,
            reason: `Overdue fine`,
            status: 'unpaid',
          },
        }),
        this.prisma.member.update({
          where: { id: borrow.memberId },
          data: { outstandingFines: { increment: fineAmount } },
        }),
      );
    }

    const [updatedBorrow] = await this.prisma.$transaction(ops);
    return updatedBorrow;
  }

  async renewBorrow(id: string) {
    const borrow = await this.prisma.borrow.findUnique({ where: { id } });
    if (!borrow) throw new NotFoundException('Borrow record not found');
    if (borrow.returnedAt) throw new BadRequestException('Book already returned');
    if (borrow.renewCount >= MAX_RENEWALS) {
      throw new BadRequestException(`Maximum renewals (${MAX_RENEWALS}) reached`);
    }

    const newDue = new Date(borrow.dueAt);
    newDue.setDate(newDue.getDate() + 14); // 2 week extension

    return this.prisma.borrow.update({
      where: { id },
      data: {
        dueAt: newDue,
        renewCount: { increment: 1 },
        status: 'renewed',
      },
    });
  }

  // ─── RESERVATIONS ─────────────────────────────────────────────────────────

  async findAllReservations(query: CirculationQueryDto) {
    const { search, status, memberId, bookId, page = 1, pageSize = 10, sortBy = 'reservedAt', sortDir = 'desc' } = query;

    const where: Prisma.ReservationWhereInput = {
      ...(memberId && { memberId }),
      ...(bookId && { bookId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { book: { title: { contains: search, mode: 'insensitive' } } },
          { member: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: {
          book: { select: { id: true, title: true, isbn: true, coverColor: true } },
          member: { select: { id: true, name: true, email: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortDir },
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  }

  async createReservation(dto: CreateReservationDto) {
    const [book, member] = await Promise.all([
      this.prisma.book.findUnique({ where: { id: dto.bookId } }),
      this.prisma.member.findUnique({ where: { id: dto.memberId } }),
    ]);

    if (!book) throw new NotFoundException('Book not found');
    if (!member) throw new NotFoundException('Member not found');

    const existing = await this.prisma.reservation.findFirst({
      where: { bookId: dto.bookId, memberId: dto.memberId, status: 'pending' },
    });
    if (existing) throw new ConflictException('Active reservation already exists for this member and book');

    const queueCount = await this.prisma.reservation.count({
      where: { bookId: dto.bookId, status: 'pending' },
    });

    return this.prisma.reservation.create({
      data: {
        bookId: dto.bookId,
        memberId: dto.memberId,
        expiresAt: new Date(dto.expiresAt),
        queuePosition: queueCount + 1,
        status: 'pending',
      },
      include: {
        book: { select: { id: true, title: true } },
        member: { select: { id: true, name: true } },
      },
    });
  }

  async updateReservationStatus(id: string, dto: UpdateReservationStatusDto) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return this.prisma.reservation.update({ where: { id }, data: { status: dto.status } });
  }

  async cancelReservation(id: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return this.prisma.reservation.update({ where: { id }, data: { status: 'cancelled' } });
  }

  // ─── FINES ────────────────────────────────────────────────────────────────

  async findAllFines(query: CirculationQueryDto) {
    const { search, status, memberId, page = 1, pageSize = 10, sortBy = 'createdAt', sortDir = 'desc' } = query;

    const where: Prisma.FineWhereInput = {
      ...(memberId && { memberId }),
      ...(status && { status }),
      ...(search && {
        member: { name: { contains: search, mode: 'insensitive' } },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.fine.findMany({
        where,
        include: {
          member: { select: { id: true, name: true, email: true } },
          borrow: { include: { book: { select: { id: true, title: true } } } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortDir },
      }),
      this.prisma.fine.count({ where }),
    ]);

    return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  }

  async settleFine(id: string, dto: SettleFineDto) {
    const fine = await this.prisma.fine.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!fine) throw new NotFoundException('Fine not found');
    if (fine.status !== 'unpaid') throw new BadRequestException('Fine is already settled');

    const [updatedFine] = await this.prisma.$transaction([
      this.prisma.fine.update({ where: { id }, data: { status: dto.action } }),
      this.prisma.member.update({
        where: { id: fine.memberId },
        data: { outstandingFines: { decrement: fine.amount } },
      }),
    ]);

    return updatedFine;
  }
}
