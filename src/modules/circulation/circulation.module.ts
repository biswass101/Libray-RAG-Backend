import { Module } from '@nestjs/common';
import { CirculationService } from './circulation.service';
import { BorrowsController } from './borrows.controller';
import { ReservationsController } from './reservations.controller';
import { FinesController } from './fines.controller';

@Module({
  controllers: [BorrowsController, ReservationsController, FinesController],
  providers: [CirculationService],
  exports: [CirculationService],
})
export class CirculationModule {}
