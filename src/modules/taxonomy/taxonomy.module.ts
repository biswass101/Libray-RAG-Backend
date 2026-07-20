import { Module } from '@nestjs/common';

import { CategoriesController } from './controllers/categories.controller';
import { AuthorsController } from './controllers/authors.controller';
import { PublishersController } from './controllers/publishers.controller';
import { CategoriesService } from './services/categories.service';
import { AuthorsService } from './services/authors.service';
import { PublishersService } from './services/publishers.service';

@Module({
  controllers: [CategoriesController, AuthorsController, PublishersController],
  providers: [CategoriesService, AuthorsService, PublishersService],
})
export class TaxonomyModule {}
