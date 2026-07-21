import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import OpenAI from 'openai';
import * as fs from 'fs';

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private openrouter: OpenAI;
  private model: string;

  // Lazy-loaded local embedding pipeline
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private embeddingPipeline: any | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY') ?? '';
    this.model =
      this.config.get<string>('OPENROUTER_MODEL') ??
      'openai/gpt-oss-20b:free';

    this.openrouter = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://library-rag.app',
        'X-Title': 'Library RAG',
      },
    });
  }

  async onModuleInit() {
    // Warm up the embedding pipeline on startup so the first request is fast
    try {
      await this.getEmbeddingPipeline();
      this.logger.log('Local embedding pipeline ready');
    } catch (err) {
      this.logger.warn(`Embedding pipeline warm-up failed: ${err.message}`);
    }
  }

  // ─── EMBEDDING (local via @xenova/transformers) ───────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getEmbeddingPipeline(): Promise<any> {
    if (this.embeddingPipeline) return this.embeddingPipeline;

    // Dynamic import to avoid ESM/CJS issues at module load time
    const { pipeline, env } = await import('@xenova/transformers');

    // Cache models in the project's .cache directory instead of ~/.cache
    env.cacheDir = './.xenova_cache';

    this.embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { quantized: true }, // ~25 MB quantized model
    );

    return this.embeddingPipeline;
  }

  private async embedText(text: string): Promise<number[]> {
    const extractor = await this.getEmbeddingPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    // output.data is a Float32Array → convert to plain number[]
    return Array.from(output.data as Float32Array);
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
        const vector = await this.embedText(chunk);
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

  // ─── CHAT (via OpenRouter) ────────────────────────────────────────────────

  async chat(question: string): Promise<{ answer: string; sources: unknown[] }> {
    // 1. Embed the user question using local model
    const queryVector = await this.embedText(question);

    // 2. Similarity search in pgvector (top 5 chunks)
    const results: Record<string, unknown>[] = await this.prisma.$queryRawUnsafe(
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
        answer:
          "I couldn't find relevant information in the library documents. Please try rephrasing your question.",
        sources: [],
      };
    }

    // 3. Build context from retrieved chunks
    const context = results
      .map((r, i) => `[${i + 1}] ${r.content}`)
      .join('\n\n');

    // 4. Generate answer via OpenRouter
    const prompt = `You are a helpful library assistant. Answer the question based ONLY on the provided context from library documents. If the context does not contain the answer, say so clearly.

Context:
${context}

Question: ${question}

Answer:`;

    const completion = await this.openrouter.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const choiceMsg = completion.choices[0]?.message;
    const answer =
      choiceMsg?.content ||
      (choiceMsg as any)?.reasoning ||
      'No answer returned.';

    const sources = results.map((r) => ({
      documentId: r.documentId,
      documentName: r.documentName,
      snippet: String(r.content).substring(0, 200) + '...',
      page: r.page,
      score: parseFloat(String(r.score)),
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

      if (
        mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const loader = new DocxLoader(filePath);
        const docs = await loader.load();
        return docs.map((d) => d.pageContent).join('\n\n');
      }

      if (mimetype === 'text/plain') {
        return fs.readFileSync(filePath, 'utf-8');
      }

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
