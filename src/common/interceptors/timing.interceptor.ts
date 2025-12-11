import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsedTime = Date.now() - now;
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        const url = request.url;
        this.logger.log(`${method} ${url} - ${elapsedTime}ms`);
      })
    );
  }
}
