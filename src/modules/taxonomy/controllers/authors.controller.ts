import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthorsService } from '../services/authors.service';
import { CreateAuthorDto, UpdateAuthorDto, TaxonomyQueryDto } from '../dto/taxonomy.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Authors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('authors')
export class AuthorsController {
  constructor(private readonly service: AuthorsService) {}

  @Get()
  findAll(@Query() query: TaxonomyQueryDto) { return this.service.findAll(query); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Roles('admin', 'librarian')
  create(@Body() dto: CreateAuthorDto) { return this.service.create(dto); }

  @Put(':id')
  @Roles('admin', 'librarian')
  update(@Param('id') id: string, @Body() dto: UpdateAuthorDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @Roles('admin', 'librarian')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
