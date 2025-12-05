import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { RequestUtil } from '@/common/util/request.util';

export interface IClientInfoData {
  ip: string;
  userAgent: string;
}

export const ClientInfo = createParamDecorator((_: unknown, ctx: ExecutionContext): IClientInfoData => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const userAgent = request.headers['user-agent'] ?? 'unknown';
  const ip = RequestUtil.extractIp(request);

  return { ip, userAgent };
});
