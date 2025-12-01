import { Body, Controller, Headers, Ip, Post, Res } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import type { Response } from 'express';
import { Public } from '@/common/decorators';
import { SignInDto } from '@/modules/auth/dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('sign-in')
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
    @Headers('userAgent') userAgent: string,
    @Ip() ipAddress: string
  ) {
    const { id, email } = await this.authService.validateUser(dto.identifier, dto.password);

    const token = await this.authService.generateJwtTokens({ userId: id, email }, userAgent, ipAddress);
    this.authService.setAuthCookies(res, token);
    return { data: { id, message: 'signIn successfully' } };
  }

  @Public()
  @Post('sign-up')
  async signup() {}
}
