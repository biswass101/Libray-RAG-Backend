import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsNumber,
  Min, Max, IsUUID, IsHexColor
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateBookDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @IsString() @IsNotEmpty() isbn: string;
  @ApiProperty() @IsUUID() categoryId: string;
  @ApiProperty() @IsUUID() authorId: string;
  @ApiProperty() @IsUUID() publisherId: string;
  @ApiProperty() @IsInt() @Type(() => Number) publishedYear: number;
  @ApiProperty() @IsInt() @Min(1) @Type(() => Number) totalCopies: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Type(() => Number) availableCopies: number
  @ApiPropertyOptional() @IsOptional() @IsString() shelfLocation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() language?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Type(() => Number) pages?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() coverColor?: string;
}

export class UpdateBookDto extends PartialType(CreateBookDto) { }

export class BookQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() authorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() pageSize?: number = 10;
  @ApiPropertyOptional() @IsOptional() @IsString() sortBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sortDir?: 'asc' | 'desc';
}
