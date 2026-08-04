import { Module } from '@nestjs/common';
import { DronesModule } from '../drones/drones.module';
import { OrdersModule } from '../orders/orders.module';
import { ZonesModule } from '../zones/zones.module';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { SimulationService } from './simulation.service';

@Module({
  imports: [DronesModule, OrdersModule, ZonesModule],
  controllers: [DeliveriesController],
  providers: [DeliveriesService, SimulationService],
})
export class DeliveriesModule {}
