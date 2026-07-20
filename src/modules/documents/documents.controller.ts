import {
  Controller, Get, Post, Delete, Param, Query, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DocumentsService } from './documents.service';
import { RagService } from '../rag/rag.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody,
} from '@nestjs/swagger';

const ALLOWED_MIMETYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
];

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly ragService: RagService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all uploaded documents' })
  findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
  ) {
    return this.documentsService.findAll({ page, pageSize, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document details' })
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Upload a document (PDF, DOCX, TXT, Image)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
          return cb(new BadRequestException('Unsupported file type'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    // 1. Persist document metadata
    const document = await this.documentsService.createFromUpload(file, user.id);

    // 2. Kick off indexing asynchronously (fire-and-forget)
    this.ragService.indexDocument(document.id, file.path, file.mimetype).catch(console.error);

    return document;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document and its vector embeddings' })
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
