import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { BooksService } from './books.service';
import {
  CreateBookDto,
  UpdateBookDto,
  BookQueryDto,
  CreateShelfSlotDto,
  UpdateShelfSlotDto,
} from './dto/book.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Books')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @ApiOperation({ summary: 'List all books with pagination, filtering and search' })
  findAll(@Query() query: BookQueryDto) {
    return this.booksService.findAll(query);
  }

  @Get('shelf-slots')
  @ApiOperation({ summary: 'List all shelf slots' })
  listShelfSlots() {
    return this.booksService.listShelfSlots();
  }

  @Post('shelf-slots')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Create a new shelf slot' })
  createShelfSlot(@Body() dto: CreateShelfSlotDto) {
    return this.booksService.createShelfSlot(dto);
  }

  @Put('shelf-slots/:id')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Update a shelf slot' })
  updateShelfSlot(@Param('id') id: string, @Body() dto: UpdateShelfSlotDto) {
    return this.booksService.updateShelfSlot(id, dto);
  }

  @Delete('shelf-slots/:id')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Delete a shelf slot' })
  removeShelfSlot(@Param('id') id: string) {
    return this.booksService.removeShelfSlot(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single book by ID' })
  findOne(@Param('id') id: string) {
    return this.booksService.findOne(id);
  }

  @Get(':id/borrow-history')
  @ApiOperation({ summary: 'Get borrow history for a book' })
  getBorrowHistory(@Param('id') id: string) {
    return this.booksService.getBorrowHistory(id);
  }

  @Post()
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Create a new book' })
  create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  @Put(':id')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Update a book' })
  update(@Param('id') id: string, @Body() dto: UpdateBookDto) {
    return this.booksService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Delete a book' })
  remove(@Param('id') id: string) {
    return this.booksService.remove(id);
  }
}
