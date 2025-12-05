import { ClassConstructor, plainToInstance } from 'class-transformer';

export function toResponseDto<T>(
  dto: ClassConstructor<T>,
  data: any | any[],
): T[] {
  const converted = plainToInstance(dto, data, {
    excludeExtraneousValues: true,
    enableImplicitConversion: false,
  });

  return Array.isArray(converted) ? converted : [converted];
}