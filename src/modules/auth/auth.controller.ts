import { Body, Controller, Headers, Ip, Post, Req, Res } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import type { Response, Request } from 'express';
import { ClientIp, Public } from '@/common/decorators';
import { SendVerificationEmailDto, SignInDto, SignUpDto, VerifyEmailDto } from '@/modules/auth/dto';
import { CheckBlacklist } from '@/common/decorators';
import { VerifyEmailService } from '@/modules/auth/verify-email.service';
import { AUTH_COOKIE } from '@/common/constants/auth';
import { CustomException } from '@/common/exceptions';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verifyEmailService: VerifyEmailService
  ) {}

  @Public()
  @Post('sign-in')
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
    @Headers('userAgent') userAgent: string,
    @Ip() ipAddress: string
  ) {
    const { id, email } = await this.authService.validateUser(dto.identifier, dto.password);

    const token = await this.authService.generateJwtTokens({ payload: { userId: id, email }, userAgent, ipAddress });
    this.authService.setAuthCookies(res, token);
    return { id, message: 'signIn successfully' };
  }

  @Public()
  @Post('sign-up')
  async signup(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
    @Headers('userAgent') userAgent: string,
    @Ip() ipAddress: string
  ) {
    const { id, email } = await this.authService.signUp(dto);

    const token = await this.authService.generateJwtTokens({ payload: { userId: id, email }, userAgent, ipAddress });
    this.authService.setAuthCookies(res, token);
    return { id, message: 'signUp successfully' };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('userAgent') userAgent: string,
    @Ip() ipAddress: string
  ) {
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];

    if (!refreshToken) {
      throw new CustomException('FORBIDDEN');
    }

    const token = await this.authService.rotateRefreshToken(refreshToken, ipAddress, userAgent);
    this.authService.setAuthCookies(res, token);
    return 'RefreshToken rotated';
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
    await this.authService.clearAuthCookies(res, refreshToken);
    return 'logout successfully';
  }

  @Post('send-verification-email')
  @CheckBlacklist()
  async sendVerificationEmail(@Body() dto: SendVerificationEmailDto, @ClientIp() ip: string) {
    return this.verifyEmailService.requestEmailVerification(dto.email, ip);
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.verifyEmailService.verifyEmail(dto.email, dto.token);
  }
}
