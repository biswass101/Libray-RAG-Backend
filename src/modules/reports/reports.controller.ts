import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Reports & Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get top-level dashboard statistics' })
  getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }

  @Get('dashboard/borrow-trend')
  @ApiOperation({ summary: 'Get 12-month borrow vs return trend data' })
  getBorrowTrend() {
    return this.reportsService.getBorrowTrend();
  }

  @Get('dashboard/popular-categories')
  @ApiOperation({ summary: 'Get most borrowed book categories' })
  getPopularCategories() {
    return this.reportsService.getPopularCategories();
  }

  @Get('dashboard/monthly-stats')
  @ApiOperation({ summary: 'Get monthly stats (members, books, fines) for last 6 months' })
  getMonthlyStats() {
    return this.reportsService.getMonthlyStats();
  }

  @Get('dashboard/upcoming-due')
  @ApiOperation({ summary: 'Books due within next 7 days' })
  getUpcomingDue() {
    return this.reportsService.getUpcomingDue();
  }

  @Get('dashboard/recent-activity')
  @ApiOperation({ summary: 'Get recent system activity' })
  getRecentActivity() {
    return this.reportsService.getRecentActivity();
  }

  @Get('books/top-borrowed')
  @ApiOperation({ summary: 'Get top borrowed books' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTopBorrowedBooks(@Query('limit') limit?: number) {
    return this.reportsService.getTopBorrowedBooks(limit ? +limit : 10);
  }

  @Get('members/active')
  @ApiOperation({ summary: 'Get most active members' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getActiveMembers(@Query('limit') limit?: number) {
    return this.reportsService.getActiveMembers(limit ? +limit : 10);
  }

  @Get('borrows/stats')
  @ApiOperation({ summary: 'Get borrow statistics for a year' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getBorrowStats(@Query('year') year?: number) {
    return this.reportsService.getBorrowStats(year ? +year : undefined);
  }

  @Get('fines/stats')
  @ApiOperation({ summary: 'Get fine collection statistics' })
  getFineStats() {
    return this.reportsService.getFineStats();
  }
}
