import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CirculationService } from './circulation.service';
import { SettleFineDto, CirculationQueryDto } from './dto/circulation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Fines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fines')
export class FinesController {
  constructor(private readonly service: CirculationService) {}

  @Get()
  @ApiOperation({ summary: 'List all fines' })
  findAll(@Query() query: CirculationQueryDto) {
    return this.service.findAllFines(query);
  }

  @Patch(':id/settle')
  @ApiOperation({ summary: 'Settle or waive a fine' })
  settle(@Param('id') id: string, @Body() dto: SettleFineDto) {
    return this.service.settleFine(id, dto);
  }
}
