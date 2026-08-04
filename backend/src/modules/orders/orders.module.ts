import { Module } from '@nestjs/common';
import { DronesModule } from '../drones/drones.module';
import { ZonesModule } from '../zones/zones.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DronesModule, ZonesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
