import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { CirculationService } from './circulation.service';
import {
  IssueBorrowDto, CreateReservationDto, UpdateReservationStatusDto,
  SettleFineDto, CirculationQueryDto,
} from './dto/circulation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Circulation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('borrows')
export class BorrowsController {
  constructor(private readonly service: CirculationService) {}

  @Get()
  @ApiOperation({ summary: 'List all borrow records' })
  findAll(@Query() query: CirculationQueryDto) {
    return this.service.findAllBorrows(query);
  }

  @Post()
  @ApiOperation({ summary: 'Issue a book to a member' })
  issue(@Body() dto: IssueBorrowDto) {
    return this.service.issueBorrow(dto);
  }

  @Post(':id/return')
  @ApiOperation({ summary: 'Return a borrowed book' })
  return(@Param('id') id: string) {
    return this.service.returnBorrow(id);
  }

  @Post(':id/renew')
  @ApiOperation({ summary: 'Renew a borrow (max 2 times)' })
  renew(@Param('id') id: string) {
    return this.service.renewBorrow(id);
  }
}
