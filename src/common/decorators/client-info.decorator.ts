import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface ClientInfoData {
  ip: string;
  userAgent: string;
}

export const ClientInfo = createParamDecorator((_: unknown, ctx: ExecutionContext): ClientInfoData => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const userAgent = request.headers['user-agent'] ?? 'unknown';
  let ip = request.ip || request.socket.remoteAddress || 'unknown';

  // 프록시 뒤에 있을 경우 실제 IP 추출
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    ip = (forwarded as string).split(',')[0].trim();
    return { ip, userAgent };
  }

  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    ip = realIp as string;
    return { ip, userAgent };
  }

  return { ip, userAgent };
});
