import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PublishersService } from '../services/publishers.service';
import { CreatePublisherDto, UpdatePublisherDto, TaxonomyQueryDto } from '../dto/taxonomy.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Publishers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('publishers')
export class PublishersController {
  constructor(private readonly service: PublishersService) {}

  @Get()
  findAll(@Query() query: TaxonomyQueryDto) { return this.service.findAll(query); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Roles('admin', 'librarian')
  create(@Body() dto: CreatePublisherDto) { return this.service.create(dto); }

  @Put(':id')
  @Roles('admin', 'librarian')
  update(@Param('id') id: string, @Body() dto: UpdatePublisherDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @Roles('admin', 'librarian')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
