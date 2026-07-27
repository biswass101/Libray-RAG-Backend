# Library-RAG — Backend

REST API for **LibraryOS**, a library management system with an AI assistant powered by Retrieval-Augmented Generation (RAG). It handles the catalog, circulation, members, reports, and a document knowledge base whose contents are chunked, embedded, and queried with pgvector to ground the assistant's answers.

Built with **NestJS 11 + TypeScript**, **Prisma** on **PostgreSQL (pgvector)**, and **LangChain + OpenAI** for the RAG pipeline.

## Features

- **Auth & RBAC** — JWT (access + refresh) via Passport; role/permission guards (`Role` → `Permission` join tables)
- **Catalog** — books CRUD with search/filter/pagination; categories, authors, publishers with book counts
- **Circulation** — issue/return/renew borrows in Prisma transactions, automatic overdue fines ($0.50/day, max 2 renewals), reservations with queue positions, fine settlement (paid/waived)
- **Members** — CRUD with borrow/fine history, plan and status tracking
- **Reports** — dashboard stats, borrow trends, popular categories, monthly stats, recent activity, top-borrowed books
- **RAG** — upload PDF/DOCX/TXT documents; text is split (`RecursiveCharacterTextSplitter`), embedded with `text-embedding-3-small`, stored in a `vector(1536)` column, and retrieved by cosine similarity for `gpt-4o-mini` chat answers with source citations
- **Hardening** — helmet, CORS, global `ValidationPipe` (whitelist + transform), global exception filter, rate limiting (`@nestjs/throttler`)

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (Postgres with pgvector, Redis, pgAdmin)
- An OpenAI API key (for document indexing and chat)

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` (see the variables below), then start the infrastructure:

   ```bash
   docker compose up -d db redis pgadmin
   ```

3. Apply the schema and generate the Prisma client:

   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. Seed the admin user and demo data:

   ```bash
   npx ts-node seed.ts
   ```

   Creates `admin@libraryos.io` / `admin123` plus sample categories, authors, publishers, books, members, borrows, and reservations.

5. Run the server:

   ```bash
   npm run start:dev
   ```

   API base: `http://localhost:4000/api/v1` — Swagger docs: `http://localhost:4000/api/docs`

Alternatively, run everything (including the backend container) with `docker compose up -d`.

## Environment Variables

| Variable                                  | Description                                        |
| ----------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`                            | Postgres connection string (pgvector image)        |
| `POSTGRES_USER/PASSWORD/DB`               | Used by docker-compose for the `db` service        |
| `REDIS_HOST` / `REDIS_PORT`               | Redis connection                                   |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`| Token signing secrets                              |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | e.g. `15m` / `7d`                         |
| `OPENAI_API_KEY`                          | Embeddings + chat completion                       |
| `PORT`                                    | HTTP port (default `4000`)                         |

## Scripts

| Command             | Description                    |
| ------------------- | ------------------------------ |
| `npm run start:dev` | Dev server with watch          |
| `npm run build`     | Compile to `dist/`             |
| `npm run start:prod`| Run the compiled build         |
| `npm run test`      | Unit tests                     |
| `npm run test:e2e`  | End-to-end tests               |
| `npm run lint`      | ESLint with autofix            |

## Project Structure

```
src/
├── main.ts                    # Bootstrap: helmet, CORS, validation, Swagger, /api/v1 prefix
├── app.module.ts
├── common/
│   ├── decorators/            # @CurrentUser, @Roles, @Permissions
│   ├── guards/                # JwtAuthGuard, RolesGuard, PermissionsGuard
│   ├── filters/               # Global exception filter
│   └── prisma/                # PrismaService (global module)
└── modules/
    ├── auth/                  # Login, JWT strategy, refresh tokens
    ├── users/                 # System users (librarians/admins)
    ├── books/                 # Catalog CRUD + borrow history
    ├── taxonomy/              # Categories, authors, publishers
    ├── members/               # Library members + histories
    ├── circulation/           # Borrows, fines, reservations
    ├── documents/             # Knowledge-base uploads (multer → uploads/)
    ├── rag/                   # Indexing pipeline + /rag/chat
    └── reports/               # Dashboard & analytics endpoints

prisma/schema.prisma           # Data model (incl. DocumentChunk with vector(1536))
seed.ts                        # Admin user + demo data (idempotent)
docker-compose.yml             # db (pgvector), redis, pgadmin, backend
```

## API Conventions

- All routes are prefixed with `/api/v1` and (except auth) require `Authorization: Bearer <accessToken>`.
- List endpoints accept `page`, `pageSize`, `search`, `sortBy`, `sortDir` (plus endpoint-specific filters like `categoryId`, `status`, `memberId`) and return a paginated envelope:

  ```json
  { "items": [], "total": 0, "page": 1, "pageSize": 10, "pageCount": 0 }
  ```

- Rows include nested relations (e.g. a borrow includes `book` and `member` selections); the frontend flattens these in its API adapter layer (`frontend/src/lib/api/services.ts`).

Full, always-current documentation is available in Swagger at `/api/docs`.

## RAG Pipeline

1. `POST /documents` (multipart) stores the file in `uploads/` and creates a `Document` row with status `processing`.
2. The file is loaded (PDF/DOCX/TXT), split into chunks, embedded with OpenAI `text-embedding-3-small`, and inserted into `DocumentChunk.embedding` (`vector(1536)`).
3. `POST /rag/chat` embeds the question, retrieves the top chunks by cosine distance (`<=>`), and asks `gpt-4o-mini` to answer using only that context — returning the answer plus scored source snippets.
