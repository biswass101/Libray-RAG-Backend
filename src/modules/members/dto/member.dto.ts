import {
  IsString, IsNotEmpty, IsOptional, IsEmail,
  IsDateString, IsEnum,
  IsIn
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum MemberPlan { STANDARD = 'standard', PREMIUM = 'premium', STUDENT = 'student' }
export enum MemberStatus { ACTIVE = 'active', SUSPENDED = 'suspended', EXPIRED = 'expired' }

export class CreateMemberDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    enum: ['active', 'suspended', 'expired'],
    default: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'suspended', 'expired'])
  status: string = 'active';

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MemberPlan)
  plan?: MemberPlan;

  @ApiProperty()
  @IsDateString()
  expiresAt!: string;
}

export class UpdateMemberDto extends PartialType(CreateMemberDto) {
  @ApiPropertyOptional() @IsOptional() @IsEnum(MemberStatus) status?: MemberStatus;
}

export class MemberQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() plan?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) pageSize?: number = 10;
  @ApiPropertyOptional() @IsOptional() @IsString() sortBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sortDir?: 'asc' | 'desc';
}
