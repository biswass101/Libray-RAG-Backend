import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto, UpdateBookDto, BookQueryDto } from './dto/book.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Books')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @ApiOperation({ summary: 'List all books with pagination, filtering and search' })
  findAll(@Query() query: BookQueryDto) {
    return this.booksService.findAll(query);
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
  @ApiOperation({ summary: 'Create a new book' })
  create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a book' })
  update(@Param('id') id: string, @Body() dto: UpdateBookDto) {
    return this.booksService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a book' })
  remove(@Param('id') id: string) {
    return this.booksService.remove(id);
  }
}
