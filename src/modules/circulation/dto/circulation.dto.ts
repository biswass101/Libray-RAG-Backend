import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString, IsEnum, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IssueBorrowDto {
  @ApiProperty() @IsUUID() bookId: string;
  @ApiProperty() @IsUUID() memberId: string;
  @ApiProperty() @IsDateString() dueAt: string;
}

export class ReturnBorrowDto {
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateReservationDto {
  @ApiProperty() @IsUUID() bookId: string;
  @ApiProperty() @IsUUID() memberId: string;
  @ApiProperty() @IsDateString() expiresAt: string;
}

export class UpdateReservationStatusDto {
  @ApiProperty({ enum: ['pending','ready','fulfilled','cancelled','expired'] })
  @IsEnum(['pending','ready','fulfilled','cancelled','expired'])
  status: string;
}

export class SettleFineDto {
  @ApiProperty({ enum: ['paid','waived'] })
  @IsEnum(['paid','waived'])
  action: 'paid' | 'waived';
}

export class CirculationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() memberId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bookId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) pageSize?: number = 10;
  @ApiPropertyOptional() @IsOptional() @IsString() sortBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sortDir?: 'asc' | 'desc';
}
