import { ClassConstructor, plainToInstance } from 'class-transformer';

export function toResponseDto<T>(dto: ClassConstructor<T>, data: any[]): T[];
export function toResponseDto<T>(dto: ClassConstructor<T>, data: any): T;
export function toResponseDto<T>(dto: ClassConstructor<T>, data: any): T | T[] {
  return plainToInstance(dto, data, {
    excludeExtraneousValues: true,
    enableImplicitConversion: false
  });
}
