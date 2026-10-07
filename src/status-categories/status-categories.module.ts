import { Module } from '@nestjs/common';
import { StatusCategoriesController } from './status-categories.controller';
import { StatusCategoriesService } from './status-categories.service';

@Module({
  controllers: [StatusCategoriesController],
  providers: [StatusCategoriesService],
  exports: [StatusCategoriesService],
})
export class StatusCategoriesModule {}
