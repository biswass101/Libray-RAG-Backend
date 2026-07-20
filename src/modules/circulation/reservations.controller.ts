import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { CirculationService } from './circulation.service';
import {
  CreateReservationDto, UpdateReservationStatusDto, CirculationQueryDto,
} from './dto/circulation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly service: CirculationService) {}

  @Get()
  @ApiOperation({ summary: 'List all reservations' })
  findAll(@Query() query: CirculationQueryDto) {
    return this.service.findAllReservations(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a reservation for a book' })
  create(@Body() dto: CreateReservationDto) {
    return this.service.createReservation(dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update reservation status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateReservationStatusDto) {
    return this.service.updateReservationStatus(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a reservation' })
  cancel(@Param('id') id: string) {
    return this.service.cancelReservation(id);
  }
}
