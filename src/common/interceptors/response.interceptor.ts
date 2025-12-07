import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { SKIP_RESPONSE_TRANSFORM } from '@/common/decorators';
import { ISuccessResponse } from '@/common/interface/response.interface';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ISuccessResponse<T> | T> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ISuccessResponse<T> | T> {
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

        const responseBody: ISuccessResponse<T> = {
          success: true,
          timestamp: new Date().toISOString()
        };

        // 💡 data 값이 null, undefined, 또는 void가 아닐 경우에만 data 필드를 추가
        if (data !== null && data !== undefined) {
          responseBody.data = data;
        }

        return responseBody;
      })
    );
  }
}
