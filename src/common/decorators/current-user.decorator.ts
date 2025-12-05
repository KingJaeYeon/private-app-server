import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@generated/prisma/client';
import { IJwtPayload } from '@/modules/auth/strategies/jwt.strategy';

export const CurrentUser = createParamDecorator((data: keyof IJwtPayload | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as User;

  return data ? user?.[data] : user;
});
