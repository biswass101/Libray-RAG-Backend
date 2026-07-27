import {
  Injectable, NotFoundException, BadRequestException, ConflictException, Logger, Inject
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  IssueBorrowDto, ReturnBorrowDto, CreateReservationDto,
  UpdateReservationStatusDto, SettleFineDto, CirculationQueryDto, UpdateBorrowDto, UpdateReservationDto
} from './dto/circulation.dto';
import { Prisma } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getPlanConstraints } from '../../common/config/plan-constraints';

@Injectable()
export class CirculationService {
  private readonly logger = new Logger(CirculationService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

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

    const constraints = getPlanConstraints(member.plan);

    if (member.activeBorrows >= constraints.maxBorrows) {
      throw new BadRequestException(
        `Borrow limit reached: ${member.plan} plan allows max ${constraints.maxBorrows} books at a time`
      );
    }

    const dueAt = dto.dueAt
      ? new Date(dto.dueAt)
      : new Date(Date.now() + constraints.borrowDurationDays * 86_400_000);

    const [borrow] = await this.prisma.$transaction([
      this.prisma.borrow.create({
        data: {
          bookId: dto.bookId,
          memberId: dto.memberId,
          dueAt,
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

    if (borrow.status === 'overdue') {
      const unpaidFine = await this.prisma.fine.findFirst({
        where: { borrowId: id, status: 'unpaid' },
      });
      if (unpaidFine) {
        throw new BadRequestException(
          `Cannot return: Outstanding fine of $${unpaidFine.amount.toFixed(2)} must be paid first`
        );
      }
    }

    const constraints = getPlanConstraints(borrow.member.plan);
    const now = new Date();
    const dueDate = new Date(borrow.dueAt);
    let fineAmount = 0;
    let status = 'returned';

    if (now > dueDate) {
      const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const chargeableDays = Math.max(0, daysOverdue - constraints.gracePeriodDays);
      fineAmount = chargeableDays * constraints.finePerDay;
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
    await this.invalidateReportsCaches();
    return updatedBorrow;
  }

  async renewBorrow(id: string) {
    const borrow = await this.prisma.borrow.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!borrow) throw new NotFoundException('Borrow record not found');
    if (borrow.returnedAt) throw new BadRequestException('Book already returned');

    const constraints = getPlanConstraints(borrow.member.plan);

    if (borrow.renewCount >= constraints.maxRenewals) {
      throw new BadRequestException(
        `Maximum renewals (${constraints.maxRenewals}) reached for ${borrow.member.plan} plan`
      );
    }

    if (borrow.status === 'overdue') {
      const unpaidFine = await this.prisma.fine.findFirst({
        where: { borrowId: id, status: 'unpaid' },
      });
      if (unpaidFine) {
        throw new BadRequestException(
          `Cannot renew: Outstanding fine of $${unpaidFine.amount.toFixed(2)} must be paid first`
        );
      }
    }

    const newDue = new Date(borrow.dueAt);
    newDue.setDate(newDue.getDate() + constraints.renewalExtensionDays);

    const updatedBorrow = await this.prisma.borrow.update({
      where: { id },
      data: {
        dueAt: newDue,
        renewCount: { increment: 1 },
        status: 'renewed',
        fineAmount: 0,
      },
      include: {
        book: { select: { id: true, title: true, isbn: true } },
        member: { select: { id: true, name: true } },
      },
    });

    await this.invalidateReportsCaches();
    return updatedBorrow;
  }

  async updateBorrow(id: string, dto: UpdateBorrowDto) {
    const borrow = await this.prisma.borrow.findUnique({ where: { id } });
    if (!borrow) throw new NotFoundException('Borrow record not found');
    if (borrow.returnedAt) throw new BadRequestException('Cannot edit returned borrow');

    const updateData: any = {};
    if (dto.dueAt) updateData.dueAt = new Date(dto.dueAt);
    if (dto.status) updateData.status = dto.status;

    return this.prisma.borrow.update({
      where: { id },
      data: updateData,
      include: {
        book: { select: { id: true, title: true, isbn: true } },
        member: { select: { id: true, name: true } },
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

    const constraints = getPlanConstraints(member.plan);

    const activeReservations = await this.prisma.reservation.count({
      where: { memberId: dto.memberId, status: { in: ['pending', 'ready'] } },
    });

    if (activeReservations >= constraints.maxReservations) {
      throw new BadRequestException(
        `Reservation limit reached: ${member.plan} plan allows max ${constraints.maxReservations} active reservations`
      );
    }

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

  async updateReservation(id: string, dto: UpdateReservationDto) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('Reservation not found');

    const updateData: any = {};
    if (dto.expiresAt) updateData.expiresAt = new Date(dto.expiresAt);
    if (dto.queuePosition !== undefined) updateData.queuePosition = dto.queuePosition;

    return this.prisma.reservation.update({
      where: { id },
      data: updateData,
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

    await this.invalidateReportsCaches();
    return updatedFine;
  }

  private async invalidateReportsCaches() {
    await Promise.all([
      this.cache.del('reports:fine-report'),
      this.cache.del('reports:fine-stats'),
      this.cache.del('reports:dashboard:stats'),
      this.cache.del('reports:monthly-stats'),
    ]);
  }

  @Cron('*/5 * * * *')
  async markOverdueBorrows() {
    this.logger.debug('Starting automatic overdue status marking...');

    const now = new Date();
    const result = await this.prisma.borrow.updateMany({
      where: {
        returnedAt: null,
        dueAt: { lt: now },
        status: { in: ['borrowed', 'renewed'] },
      },
      data: { status: 'overdue' },
    });

    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} borrow(s) as overdue in database`);
      await this.invalidateReportsCaches();
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processOverdueBorrows() {
    this.logger.debug('Starting automatic overdue fine processing...');

    const now = new Date();
    const overdueborrows = await this.prisma.borrow.findMany({
      where: {
        returnedAt: null,
        dueAt: { lt: now },
        status: 'overdue',
      },
      include: { member: true },
    });

    if (overdueborrows.length === 0) {
      this.logger.debug('No overdue borrows found');
      return;
    }

    this.logger.log(`Found ${overdueborrows.length} overdue borrow(s)`);

    for (const borrow of overdueborrows) {
      try {
        const constraints = getPlanConstraints(borrow.member.plan);
        const daysOverdue = Math.ceil((now.getTime() - new Date(borrow.dueAt).getTime()) / (1000 * 60 * 60 * 24));
        const chargeableDays = Math.max(0, daysOverdue - constraints.gracePeriodDays);
        const dailyFine = chargeableDays * constraints.finePerDay;

        const existingFine = await this.prisma.fine.findFirst({
          where: { borrowId: borrow.id, status: 'unpaid' },
        });

        if (!existingFine) {
          await this.prisma.$transaction([
            this.prisma.borrow.update({
              where: { id: borrow.id },
              data: { fineAmount: dailyFine },
            }),
            this.prisma.fine.create({
              data: {
                borrowId: borrow.id,
                memberId: borrow.memberId,
                amount: dailyFine,
                reason: `Automatic overdue fine (${daysOverdue} days)`,
                status: 'unpaid',
              },
            }),
            this.prisma.member.update({
              where: { id: borrow.memberId },
              data: { outstandingFines: { increment: dailyFine } },
            }),
          ]);
          this.logger.log(`Generated fine of $${dailyFine.toFixed(2)} for borrow ${borrow.id}`);
        } else {
          const fineIncrease = dailyFine - existingFine.amount;
          if (fineIncrease > 0) {
            await this.prisma.$transaction([
              this.prisma.borrow.update({
                where: { id: borrow.id },
                data: { fineAmount: dailyFine },
              }),
              this.prisma.fine.update({
                where: { id: existingFine.id },
                data: { amount: dailyFine },
              }),
              this.prisma.member.update({
                where: { id: borrow.memberId },
                data: { outstandingFines: { increment: fineIncrease } },
              }),
            ]);
            this.logger.log(`Updated fine for borrow ${borrow.id} by $${fineIncrease.toFixed(2)}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error processing overdue borrow ${borrow.id}: ${error.message}`);
      }
    }

    this.logger.log('Overdue fine processing completed');
    await this.invalidateReportsCaches();
  }
}
