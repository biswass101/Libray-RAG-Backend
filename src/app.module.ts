import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from './modules/users/users.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { BooksModule } from './modules/books/books.module';
import { MembersModule } from './modules/members/members.module';
import { CirculationModule } from './modules/circulation/circulation.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { RagModule } from './modules/rag/rag.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    UsersModule,
    TaxonomyModule,
    BooksModule,
    MembersModule,
    CirculationModule,
    DocumentsModule,
    RagModule,
    ReportsModule,
    AuthModule,
  ],
})
export class AppModule {}
