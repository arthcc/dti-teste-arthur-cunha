import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('API de entregas por drone (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    await request(app.getHttpServer())
      .post('/deliveries/simulation/pause')
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('drones', () => {
    it('cadastra um drone e o devolve na listagem', async () => {
      const created = await request(app.getHttpServer())
        .post('/drones')
        .send({ name: 'Drone E2E', capacityKg: 10, rangeKm: 40 })
        .expect(201);

      expect(created.body).toMatchObject({
        name: 'Drone E2E',
        capacityKg: 10,
        rangeKm: 40,
        state: 'idle',
        batteryPercent: 100,
      });

      const list = await request(app.getHttpServer())
        .get('/drones')
        .expect(200);

      expect(list.body.map((d: { id: string }) => d.id)).toContain(
        created.body.id,
      );
    });

    it('expõe o status com os campos de despacho', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/drones/status')
        .expect(200);

      expect(body[0]).toMatchObject({
        available: true,
        dispatchable: true,
        remainingRangeKm: expect.any(Number),
      });
    });

    it('recusa capacidade inválida com 400', () => {
      return request(app.getHttpServer())
        .post('/drones')
        .send({ capacityKg: 0, rangeKm: 40 })
        .expect(400);
    });
  });

  describe('pedidos', () => {
    it('registra um pedido válido', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/orders')
        .send({ location: { x: 5, y: 5 }, weightKg: 2, priority: 'high' })
        .expect(201);

      expect(body).toMatchObject({
        location: { x: 5, y: 5 },
        weightKg: 2,
        priority: 'high',
        status: 'pending',
        assignedDroneId: null,
      });
    });

    it('recusa coordenadas fora da malha com 400', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({ location: { x: -1, y: 999 }, weightKg: 2, priority: 'high' })
        .expect(400);
    });

    it('recusa coordenadas fracionárias com 400', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({ location: { x: 2.5, y: 3 }, weightKg: 2, priority: 'high' })
        .expect(400);
    });

    it('recusa pacote acima da capacidade da frota com 422', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/orders')
        .send({ location: { x: 5, y: 5 }, weightKg: 200, priority: 'low' })
        .expect(422);

      expect(body.message).toMatch(/excede a capacidade do maior drone/);
    });

    it('publica os limites vigentes', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/orders/limits')
        .expect(200);

      expect(body).toMatchObject({
        gridSize: 20,
        maxCapacityKg: 10,
        maxRangeKm: 40,
        batteryReservePercent: 15,
      });
    });
  });

  describe('zonas', () => {
    it('cria e remove uma zona de exclusão', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/zones')
        .send({ name: 'Centro E2E', minX: 12, minY: 12, maxX: 14, maxY: 14 })
        .expect(201);

      expect(body).toMatchObject({ name: 'Centro E2E', blockedPoints: 9 });

      await request(app.getHttpServer())
        .delete(`/zones/${body.id}`)
        .expect(204);
    });

    it('recusa zona que cobre a base com 422', () => {
      return request(app.getHttpServer())
        .post('/zones')
        .send({ minX: 0, minY: 0, maxX: 2, maxY: 2 })
        .expect(422);
    });

    it('recusa retângulo invertido com 400', () => {
      return request(app.getHttpServer())
        .post('/zones')
        .send({ minX: 8, minY: 1, maxX: 4, maxY: 4 })
        .expect(400);
    });
  });

  describe('entregas', () => {
    it('planeja a rota dos pedidos pendentes', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/deliveries/route')
        .expect(200);

      expect(body).toMatchObject({
        totalTrips: expect.any(Number),
        totalAssignedOrders: expect.any(Number),
        totalDistanceKm: expect.any(Number),
        makespanMinutes: expect.any(Number),
      });
      expect(body.trips.length).toBeGreaterThan(0);

      const trip = body.trips[0];
      expect(trip.path[0]).toEqual({ x: 0, y: 0 });
      expect(trip.path[trip.path.length - 1]).toEqual({ x: 0, y: 0 });
      expect(trip.totalWeightKg).toBeLessThanOrEqual(10);
    });

    it('expõe e controla o relógio da simulação', async () => {
      const paused = await request(app.getHttpServer())
        .get('/deliveries/simulation')
        .expect(200);

      expect(paused.body.running).toBe(false);

      const resumed = await request(app.getHttpServer())
        .post('/deliveries/simulation/resume')
        .expect(200);

      expect(resumed.body.running).toBe(true);

      await request(app.getHttpServer())
        .post('/deliveries/simulation/pause')
        .expect(200);
    });

    it('reinicia a simulação devolvendo a frota à base', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/deliveries/simulation/reset')
        .expect(200);

      expect(body).toMatchObject({
        clockMinutes: 0,
        activeFlights: 0,
        ordersDelivered: 0,
        totalFlightMinutes: 0,
      });
    });
  });
});
