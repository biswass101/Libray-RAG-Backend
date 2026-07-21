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

  async getBorrowReport() {
    const [trend, byStatusRaw, rows] = await Promise.all([
      this.getBorrowTrend(),
      this.prisma.borrow.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.borrow.findMany({
        orderBy: { issuedAt: 'desc' },
        take: 20,
        include: {
          book: { select: { title: true } },
          member: { select: { name: true } },
        },
      }),
    ]);

    return {
      trend,
      byStatus: byStatusRaw.map((s) => ({ name: s.status, value: s._count._all })),
      rows,
    };
  }

  async getMemberReport() {
    const [byPlanRaw, byStatusRaw, growth, top] = await Promise.all([
      this.prisma.member.groupBy({ by: ['plan'], _count: { _all: true } }),
      this.prisma.member.groupBy({ by: ['status'], _count: { _all: true } }),
      this.getMonthlyStats(),
      this.getActiveMembers(10),
    ]);

    return {
      byPlan: byPlanRaw.map((p) => ({ name: p.plan, value: p._count._all })),
      byStatus: byStatusRaw.map((s) => ({ name: s.status, value: s._count._all })),
      growth,
      top,
    };
  }

  async getBookReport() {
    const [categories, top, lowStock] = await Promise.all([
      this.prisma.category.findMany({
        include: { _count: { select: { books: true } } },
      }),
      this.getTopBorrowedBooks(10),
      this.prisma.book.findMany({
        where: { availableCopies: { lte: 2 } },
        include: { category: { select: { name: true } } },
        orderBy: { availableCopies: 'asc' },
        take: 20,
      }),
    ]);

    return {
      byCategory: categories
        .map((c) => ({ name: c.name, value: c._count.books }))
        .filter((c) => c.value > 0)
        .sort((a, b) => b.value - a.value),
      top,
      lowStock,
    };
  }

  async getFineReport() {
    const stats = await this.getFineStats();

    const months = 6;
    const monthly = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const collected = await this.prisma.fine.aggregate({
        _sum: { amount: true },
        where: {
          status: 'paid',
          createdAt: { gte: startOfMonth(date), lte: endOfMonth(date) },
        },
      });
      monthly.push({ month: format(date, 'MMM yy'), finesCollected: collected._sum.amount ?? 0 });
    }

    const rows = await this.prisma.fine.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        member: { select: { name: true } },
        borrow: { include: { book: { select: { title: true } } } },
      },
    });

    return {
      total: stats.total,
      collected: stats.collected,
      outstanding: stats.unpaid,
      byStatus: [
        { name: 'paid', value: stats.collected },
        { name: 'unpaid', value: stats.unpaid },
        { name: 'waived', value: stats.waived },
      ].filter((s) => s.value > 0),
      monthly,
      rows,
    };
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
