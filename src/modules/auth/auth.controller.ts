import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import type { Request, Response } from 'express';
import { CheckBlacklist, ClientInfo, Public } from '@/common/decorators';
import { SendVerificationEmailDto, SignInDto, SignUpDto, VerifyEmailDto } from '@/modules/auth/dto';
import { VerifyEmailService } from '@/modules/auth/verify-email.service';
import { AUTH_COOKIE } from '@/common/constants/auth';
import { CustomException } from '@/common/exceptions';
import { type ClientInfoData } from '@/common/decorators/client-info.decorator';
import { ApiActionResponse } from '@/common/decorators/api-action-response.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verifyEmailService: VerifyEmailService
  ) {}

  @Public()
  @ApiActionResponse({ id: 'userId', message: 'signIn successfully check cookies' })
  @Post('sign-in')
  async signIn(@Body() dto: SignInDto, @Res({ passthrough: true }) res: Response, @ClientInfo() info: ClientInfoData) {
    const { id, email } = await this.authService.validateUser(dto.identifier, dto.password);
    const token = await this.authService.generateJwtTokens({
      payload: { userId: id, email },
      userAgent: info.userAgent,
      ipAddress: info.ip
    });
    this.authService.setAuthCookies(res, token);
    return { id, message: 'signIn successfully' };
  }

  @Public()
  @Post('sign-up')
  @ApiActionResponse({ id: 'userId', message: 'signUp successfully check cookies' })
  async signup(@Body() dto: SignUpDto, @Res({ passthrough: true }) res: Response, @ClientInfo() info: ClientInfoData) {
    const { id, email } = await this.authService.signUp(dto);
    const token = await this.authService.generateJwtTokens({
      payload: { userId: id, email },
      userAgent: info.userAgent,
      ipAddress: info.ip
    });
    this.authService.setAuthCookies(res, token);
    return { id, message: 'signUp successfully' };
  }

  @Post('refresh')
  @ApiActionResponse({ message: 'RefreshToken rotated check cookies' })
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @ClientInfo() info: ClientInfoData) {
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];

    if (!refreshToken) {
      throw new CustomException('FORBIDDEN');
    }

    const token = await this.authService.rotateRefreshToken(refreshToken, info.ip, info.userAgent);
    this.authService.setAuthCookies(res, token);
    return 'RefreshToken rotated';
  }

  @Post('logout')
  @HttpCode(200)
  @ApiActionResponse({ message: 'logout successfully' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
    await this.authService.clearAuthCookies(res, refreshToken);
    return 'logout successfully';
  }

  @Public()
  @Post('send-verification-email')
  @ApiActionResponse({ message: '인증 이메일이 발송되었습니다 - ?분' })
  @CheckBlacklist()
  async sendVerificationEmail(@Body() dto: SendVerificationEmailDto, @ClientInfo() { ip }: ClientInfoData) {
    return this.verifyEmailService.requestEmailVerification(dto.email, ip);
  }

  @Public()
  @Post('verify-email')
  @ApiActionResponse({ message: 'verify email success' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.verifyEmailService.verifyEmail(dto.email, dto.token);
  }
}
