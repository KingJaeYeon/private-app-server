import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(_: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // AllExceptionsFilter->ResponseInterceptor 인데 main.ts 에서 순서 변경할 경우를 대비한 방어로직
        if (data && data.success === false) {
          return data;
        }

        // TODO: SSE / Stream 처리도 따로 해줘야함

        return {
          success: true,
          data,
          timestamp: new Date().toISOString()
        };
      })
    );
  }
}
