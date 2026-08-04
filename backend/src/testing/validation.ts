import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';

function flatten(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flatten(error.children ?? []),
  ]);
}

export function validateForm<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): string[] {
  const instance = plainToInstance(cls, payload);
  return flatten(
    validateSync(instance, { whitelist: true, forbidNonWhitelisted: true }),
  );
}

export function expectNoErrors<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): void {
  expect(validateForm(cls, payload)).toEqual([]);
}
