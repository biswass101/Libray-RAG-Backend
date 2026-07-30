import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto, UpdateMemberDto, MemberQueryDto } from './dto/member.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PLAN_CONSTRAINTS } from '../../common/config/plan-constraints';

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get('plan-constraints')
  @ApiOperation({ summary: 'Get membership plan constraints for all plans' })
  getPlanConstraints() {
    return PLAN_CONSTRAINTS;
  }

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
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Register a new member' })
  create(@Body() dto: CreateMemberDto) {
    return this.membersService.create(dto);
  }

  @Put(':id')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Update a member' })
  update(@Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.membersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'librarian')
  @ApiOperation({ summary: 'Delete a member' })
  remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }
}
