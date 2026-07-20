import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  startOfMonth, endOfMonth, subMonths, format
} from 'date-fns';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalBooks,
      borrowedBooks,
      availableBooks,
      members,
      librarians,
      documents,
      activeReservations,
      returnedThisMonth,
    ] = await Promise.all([
      this.prisma.book.count(),
      this.prisma.borrow.count({ where: { status: { in: ['borrowed', 'renewed', 'overdue'] } } }),
      this.prisma.book.aggregate({ _sum: { availableCopies: true } }),
      this.prisma.member.count({ where: { status: 'active' } }),
      this.prisma.user.count(),
      this.prisma.document.count({ where: { status: 'indexed' } }),
      this.prisma.reservation.count({ where: { status: { in: ['pending', 'ready'] } } }),
      this.prisma.borrow.count({
        where: {
          status: 'returned',
          returnedAt: {
            gte: startOfMonth(new Date()),
            lte: endOfMonth(new Date()),
          },
        },
      }),
    ]);

    return {
      totalBooks,
      borrowedBooks,
      returnedBooks: returnedThisMonth,
      availableBooks: availableBooks._sum.availableCopies ?? 0,
      members,
      librarians,
      documents,
      activeReservations,
    };
  }

  async getBorrowTrend() {
    const months = 12;
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);

      const [borrowed, returned] = await Promise.all([
        this.prisma.borrow.count({ where: { issuedAt: { gte: start, lte: end } } }),
        this.prisma.borrow.count({ where: { returnedAt: { gte: start, lte: end } } }),
      ]);

      result.push({
        month: format(date, 'MMM yy'),
        borrowed,
        returned,
      });
    }

    return result;
  }

  async getPopularCategories() {
    const categories = await this.prisma.category.findMany({
      include: { books: { select: { borrowCount: true } } },
    });

    return categories
      .map((c) => ({
        name: c.name,
        value: c.books.reduce((sum, b) => sum + b.borrowCount, 0),
      }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }

  async getMonthlyStats() {
    const months = 6;
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);

      const [newMembers, newBooks, finesCollected] = await Promise.all([
        this.prisma.member.count({ where: { joinedAt: { gte: start, lte: end } } }),
        this.prisma.book.count({ where: { createdAt: { gte: start, lte: end } } }),
        this.prisma.fine.aggregate({
          _sum: { amount: true },
          where: { status: 'paid', createdAt: { gte: start, lte: end } },
        }),
      ]);

      result.push({
        month: format(date, 'MMM yy'),
        newMembers,
        newBooks,
        finesCollected: finesCollected._sum.amount ?? 0,
      });
    }

    return result;
  }

  async getTopBorrowedBooks(limit = 10) {
    return this.prisma.book.findMany({
      orderBy: { borrowCount: 'desc' },
      take: limit,
      include: {
        author: { select: { name: true } },
        category: { select: { name: true } },
      },
    });
  }

  async getActiveMembers(limit = 10) {
    return this.prisma.member.findMany({
      where: { status: 'active' },
      orderBy: { totalBorrows: 'desc' },
      take: limit,
    });
  }

  async getRecentActivity(limit = 10) {
    return this.prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actor: { select: { id: true, name: true } } },
    });
  }

  async getUpcomingDue() {
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);

    return this.prisma.borrow.findMany({
      where: {
        returnedAt: null,
        dueAt: { lte: in7Days },
      },
      include: {
        book: { select: { id: true, title: true } },
        member: { select: { id: true, name: true, email: true } },
      },
      orderBy: { dueAt: 'asc' },
      take: 10,
    });
  }

  async getBorrowStats(year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const start = new Date(`${targetYear}-01-01`);
    const end = new Date(`${targetYear}-12-31`);

    const [total, returned, overdue, finesTotal] = await Promise.all([
      this.prisma.borrow.count({ where: { issuedAt: { gte: start, lte: end } } }),
      this.prisma.borrow.count({ where: { issuedAt: { gte: start, lte: end }, returnedAt: { not: null } } }),
      this.prisma.borrow.count({ where: { dueAt: { lt: new Date() }, returnedAt: null } }),
      this.prisma.fine.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: start, lte: end } },
      }),
    ]);

    return { total, returned, active: total - returned, overdue, finesTotal: finesTotal._sum.amount ?? 0 };
  }

  async getFineStats() {
    const [total, collected, unpaid, waived] = await Promise.all([
      this.prisma.fine.aggregate({ _sum: { amount: true } }),
      this.prisma.fine.aggregate({ _sum: { amount: true }, where: { status: 'paid' } }),
      this.prisma.fine.aggregate({ _sum: { amount: true }, where: { status: 'unpaid' } }),
      this.prisma.fine.aggregate({ _sum: { amount: true }, where: { status: 'waived' } }),
    ]);

    return {
      total: total._sum.amount ?? 0,
      collected: collected._sum.amount ?? 0,
      unpaid: unpaid._sum.amount ?? 0,
      waived: waived._sum.amount ?? 0,
    };
  }
}
