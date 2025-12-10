import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/common/decorators';
import { CustomException } from '@/common/exceptions';
import { TokenExpiredError } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // You can throw an exception based on either "info" or "err" arguments
    if (info instanceof TokenExpiredError) {
      throw new CustomException('UNAUTHORIZED', { message: 'jwt expired' });
    }
    // // 2) JWT 형식/서명 문제 등 (잘못된 토큰)
    // if (info instanceof JsonWebTokenError) {
    //   // console.log('Invalid JWT:', info.message);
    //   throw new CustomException('UNAUTHORIZED');
    // }

    if (err || !user) {
      throw new CustomException('UNAUTHORIZED');
    }
    return user;
  }
}
