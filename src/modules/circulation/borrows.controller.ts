import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { CirculationService } from './circulation.service';
import {
  IssueBorrowDto, CreateReservationDto, UpdateReservationStatusDto,
  SettleFineDto, CirculationQueryDto, UpdateBorrowDto,
} from './dto/circulation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Circulation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('borrows')
export class BorrowsController {
  constructor(private readonly service: CirculationService) {}

  @Get()
  @ApiOperation({ summary: 'List all borrow records' })
  findAll(@Query() query: CirculationQueryDto) {
    return this.service.findAllBorrows(query);
  }

  @Post()
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Issue a book to a member' })
  issue(@Body() dto: IssueBorrowDto) {
    return this.service.issueBorrow(dto);
  }

  @Patch(':id')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Edit a borrow record' })
  update(@Param('id') id: string, @Body() dto: UpdateBorrowDto) {
    return this.service.updateBorrow(id, dto);
  }

  @Post(':id/return')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Return a borrowed book' })
  return(@Param('id') id: string) {
    return this.service.returnBorrow(id);
  }

  @Post(':id/renew')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Renew a borrow (max 2 times)' })
  renew(@Param('id') id: string) {
    return this.service.renewBorrow(id);
  }
}
