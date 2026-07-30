import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CirculationService } from './circulation.service';
import { SettleFineDto, CirculationQueryDto } from './dto/circulation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Fines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fines')
export class FinesController {
  constructor(private readonly service: CirculationService) {}

  @Get()
  @ApiOperation({ summary: 'List all fines' })
  findAll(@Query() query: CirculationQueryDto) {
    return this.service.findAllFines(query);
  }

  @Patch(':id/settle')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Settle or waive a fine' })
  settle(@Param('id') id: string, @Body() dto: SettleFineDto) {
    return this.service.settleFine(id, dto);
  }
}
