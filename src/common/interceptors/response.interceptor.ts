import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { SKIP_RESPONSE_TRANSFORM } from '@/common/decorators/skip-response-transform.decorator';

interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T> | T> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T> | T> {
    const contextType = context.getType(); // 프로토콜 타입 체크
    if (contextType !== 'http') {
      return next.handle(); // SSE, WS는 스킵
    }

    // 명시적 스킵 데코레이터 체크
    const skipTransform = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_TRANSFORM, [
      context.getHandler(),
      context.getClass()
    ]);

    if (skipTransform) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // AllExceptionsFilter->ResponseInterceptor 인데 main.ts 에서 순서 변경할 경우를 대비한 방어로직
        if (data && data.success === false) {
          return data;
        }

        return {
          success: true,
          data,
          timestamp: new Date().toISOString()
        };
      })
    );
  }
}
