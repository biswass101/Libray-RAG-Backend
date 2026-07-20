import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { page?: number; pageSize?: number; search?: string }) {
    const { page = 1, pageSize = 10, search } = query;

    const where: Prisma.DocumentWhereInput = {
      ...(search && {
        name: { contains: search, mode: 'insensitive' },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document #${id} not found`);
    return doc;
  }

  async createFromUpload(
    file: Express.Multer.File,
    uploadedBy: string,
  ) {
    const type = this.getFileType(file.mimetype, file.originalname);
    return this.prisma.document.create({
      data: {
        name: file.originalname,
        type,
        sizeBytes: file.size,
        status: 'processing',
        uploadedBy,
      },
    });
  }

  async updateStatus(id: string, status: string, chunkCount?: number) {
    return this.prisma.document.update({
      where: { id },
      data: { status, ...(chunkCount !== undefined && { chunkCount }) },
    });
  }

  async remove(id: string) {
    const doc = await this.findOne(id);
    // Delete associated chunks
    await this.prisma.documentChunk.deleteMany({ where: { documentId: id } });
    await this.prisma.document.delete({ where: { id } });
    return { success: true, message: 'Document deleted' };
  }

  private getFileType(mimetype: string, filename: string): string {
    if (mimetype === 'application/pdf') return 'pdf';
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
    if (mimetype === 'text/plain') return 'txt';
    if (mimetype.startsWith('image/')) return 'image';
    const ext = path.extname(filename).toLowerCase();
    return ext.replace('.', '') || 'unknown';
  }
}
