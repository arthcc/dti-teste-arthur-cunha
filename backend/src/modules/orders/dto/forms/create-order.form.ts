import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsPositive,
  Max,
  ValidateNested,
} from 'class-validator';
import { Priority } from '../../../../common/enums/priority.enum';
import { LocationForm } from './location.form';

const MAX_WEIGHT_KG = 500;

export class CreateOrderForm {
  @ApiProperty({ type: LocationForm, description: 'Localização do cliente (X, Y).' })
  @IsDefined({ message: 'location é obrigatório' })
  @ValidateNested()
  @Type(() => LocationForm)
  location: LocationForm;

  @ApiProperty({ example: 3.5, description: 'Peso do pacote em quilogramas.' })
  @IsNumber(
    { maxDecimalPlaces: 3 },
    { message: 'weightKg deve ser um número com até 3 casas decimais' },
  )
  @IsPositive({ message: 'weightKg deve ser maior que zero' })
  @Max(MAX_WEIGHT_KG, {
    message: `weightKg deve ser no máximo ${MAX_WEIGHT_KG}`,
  })
  weightKg: number;

  @ApiProperty({
    enum: Priority,
    example: Priority.ALTA,
    description: 'Prioridade da entrega.',
  })
  @IsEnum(Priority, { message: 'priority deve ser baixa, media ou alta' })
  priority: Priority;
}
