import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { CirculationService } from './circulation.service';
import {
  CreateReservationDto, UpdateReservationStatusDto, CirculationQueryDto, UpdateReservationDto,
} from './dto/circulation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly service: CirculationService) {}

  @Get()
  @ApiOperation({ summary: 'List all reservations' })
  findAll(@Query() query: CirculationQueryDto) {
    return this.service.findAllReservations(query);
  }

  @Post()
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Create a reservation for a book' })
  create(@Body() dto: CreateReservationDto) {
    return this.service.createReservation(dto);
  }

  @Patch(':id')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Edit a reservation' })
  update(@Param('id') id: string, @Body() dto: UpdateReservationDto) {
    return this.service.updateReservation(id, dto);
  }

  @Patch(':id/status')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Update reservation status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateReservationStatusDto) {
    return this.service.updateReservationStatus(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Cancel a reservation' })
  cancel(@Param('id') id: string) {
    return this.service.cancelReservation(id);
  }
}
