import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto, UpdateMemberDto, MemberQueryDto } from './dto/member.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'List all members with pagination, filtering and search' })
  findAll(@Query() query: MemberQueryDto) {
    return this.membersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single member by ID' })
  findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Get(':id/borrow-history')
  @ApiOperation({ summary: 'Get borrow history for a member' })
  getBorrowHistory(@Param('id') id: string) {
    return this.membersService.getBorrowHistory(id);
  }

  @Get(':id/fine-history')
  @ApiOperation({ summary: 'Get fine history for a member' })
  getFineHistory(@Param('id') id: string) {
    return this.membersService.getFineHistory(id);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new member' })
  create(@Body() dto: CreateMemberDto) {
    return this.membersService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a member' })
  update(@Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.membersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a member' })
  remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }
}
