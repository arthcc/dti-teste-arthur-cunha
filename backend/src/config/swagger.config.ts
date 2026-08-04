import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Simulador de Entregas por Drone')
    .setDescription(
      'API para gerenciar pedidos, drones e o planejamento otimizado de entregas.',
    )
    .setVersion('1.0')
    .addTag('orders', 'Registro, consulta e limites de validação dos pedidos')
    .addTag(
      'drones',
      'Cadastro e status da frota de drones (bateria, estado, posição)',
    )
    .addTag('zones', 'Zonas de exclusão aérea que as rotas precisam contornar')
    .addTag('deliveries', 'Planejamento de rotas e relógio da simulação')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}
