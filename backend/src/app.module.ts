import { Module } from '@nestjs/common';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { DronesModule } from './modules/drones/drones.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ZonesModule } from './modules/zones/zones.module';

@Module({
  imports: [ZonesModule, DronesModule, OrdersModule, DeliveriesModule],
})
export class AppModule {}
