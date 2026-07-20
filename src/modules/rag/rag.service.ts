import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import * as fs from 'fs';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private embeddings: OpenAIEmbeddings;
  private llm: ChatOpenAI;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      modelName: 'text-embedding-3-small',
    });
    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.2,
    });
  }

  // ─── INDEXING ─────────────────────────────────────────────────────────────

  async indexDocument(documentId: string, filePath: string, mimetype: string): Promise<void> {
    this.logger.log(`Starting indexing for document ${documentId}`);
    try {
      // 1. Extract text
      const rawText = await this.extractText(filePath, mimetype);
      if (!rawText || rawText.length < 10) {
        await this.updateDocStatus(documentId, 'failed', 0);
        return;
      }

      // 2. Chunk text
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const chunks = await splitter.splitText(rawText);
      this.logger.log(`Split into ${chunks.length} chunks`);

      // 3. Generate embeddings and store
      let saved = 0;
      for (const chunk of chunks) {
        const vector = await this.embeddings.embedQuery(chunk);
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "DocumentChunk" (id, "documentId", content, embedding)
           VALUES (gen_random_uuid(), $1, $2, $3::vector)`,
          documentId,
          chunk,
          JSON.stringify(vector),
        );
        saved++;
      }

      await this.updateDocStatus(documentId, 'indexed', saved);
      this.logger.log(`Indexed ${saved} chunks for document ${documentId}`);
    } catch (err) {
      this.logger.error(`Indexing failed for ${documentId}: ${err.message}`, err.stack);
      await this.updateDocStatus(documentId, 'failed', 0);
    }
  }

  // ─── CHAT ─────────────────────────────────────────────────────────────────

  async chat(question: string): Promise<{ answer: string; sources: any[] }> {
    // 1. Embed the user question
    const queryVector = await this.embeddings.embedQuery(question);

    // 2. Similarity search in pgvector (top 5 chunks)
    const results: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT dc.id, dc.content, dc."documentId", dc.page,
              1 - (dc.embedding <=> $1::vector) AS score,
              d.name AS "documentName"
       FROM "DocumentChunk" dc
       JOIN "Document" d ON dc."documentId" = d.id
       WHERE dc.embedding IS NOT NULL
       ORDER BY dc.embedding <=> $1::vector
       LIMIT 5`,
      JSON.stringify(queryVector),
    );

    if (!results || results.length === 0) {
      return {
        answer: "I couldn't find relevant information in the library documents. Please try rephrasing your question.",
        sources: [],
      };
    }

    // 3. Build context from retrieved chunks
    const context = results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n');

    // 4. Generate answer with OpenAI
    const prompt = `You are a helpful library assistant. Answer the question based ONLY on the provided context from library documents. If the context does not contain the answer, say so clearly.

Context:
${context}

Question: ${question}

Answer:`;

    const response = await this.llm.invoke(prompt);
    const answer = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const sources = results.map((r) => ({
      documentId: r.documentId,
      documentName: r.documentName,
      snippet: r.content.substring(0, 200) + '...',
      page: r.page,
      score: parseFloat(r.score),
    }));

    return { answer, sources };
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private async extractText(filePath: string, mimetype: string): Promise<string> {
    try {
      if (mimetype === 'application/pdf') {
        const loader = new PDFLoader(filePath);
        const docs = await loader.load();
        return docs.map((d) => d.pageContent).join('\n\n');
      }

      if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const loader = new DocxLoader(filePath);
        const docs = await loader.load();
        return docs.map((d) => d.pageContent).join('\n\n');
      }

      if (mimetype === 'text/plain') {
        const rawText = fs.readFileSync(filePath, 'utf-8');
        return rawText;
      }

      // For images — return empty string (image OCR not included out of the box)
      this.logger.warn(`No text extractor for mimetype ${mimetype}`);
      return '';
    } catch (err) {
      this.logger.error(`Text extraction failed: ${err.message}`);
      return '';
    }
  }

  private async updateDocStatus(id: string, status: string, chunkCount: number) {
    await this.prisma.document.update({
      where: { id },
      data: { status, chunkCount },
    });
  }
}
