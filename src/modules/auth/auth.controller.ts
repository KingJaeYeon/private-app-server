import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import type { Request, Response } from 'express';
import { CheckBlacklist, ClientInfo, Public } from '@/common/decorators';
import { SendVerificationEmailDto, SignInDto, SignUpDto, VerifyEmailDto } from '@/modules/auth/dto';
import { VerifyEmailService } from '@/modules/auth/verify-email.service';
import { AUTH_COOKIE } from '@/common/constants/auth';
import { CustomException } from '@/common/exceptions';
import { type IClientInfoData } from '@/common/decorators/client-info.decorator';
import { ApiActionResponse, headers } from '@/common/decorators/api-action-response.decorator';
import { ApiErrorResponses } from '@/common/decorators/api-error-response.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verifyEmailService: VerifyEmailService
  ) {}

  @Public()
  @ApiActionResponse({
    body: { id: 'userId', message: 'signIn successfully.' },
    headers,
    operations: {
      summary: '로그인',
      description: ' **Access Token**과 **Refresh Token** 쿠키가 응답 헤더에 설정됩니다'
    }
  })
  @ApiErrorResponses(['INVALID_CREDENTIALS'])
  @Post('sign-in')
  async signIn(
    @Req() req: Request,
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
    @ClientInfo() info: IClientInfoData
  ) {
    const { id, email } = await this.authService.validateUser(dto.identifier, dto.password);
    const token = await this.authService.generateJwtTokens({
      payload: { userId: id, email },
      userAgent: info.userAgent,
      ipAddress: info.ip
    });
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];

    await this.authService.setSignInAuthCookies(res, token, refreshToken);
    return { id, message: 'signIn successfully.' };
  }

  @Public()
  @Post('sign-up')
  @ApiActionResponse({
    body: { id: 'userId', message: 'signUp successfully.' },
    headers,
    operations: { summary: '회원가입', description: '회원가입 성공' }
  })
  @ApiErrorResponses(['EMAIL_ALREADY_EXISTS', 'VERIFICATION_INVALID'])
  async signup(
    @Req() req: Request,
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
    @ClientInfo() info: IClientInfoData
  ) {
    const { id, email } = await this.authService.signUp(dto);
    const token = await this.authService.generateJwtTokens({
      payload: { userId: id, email },
      userAgent: info.userAgent,
      ipAddress: info.ip
    });
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
    await this.authService.setSignInAuthCookies(res, token, refreshToken);
    return { id, message: 'signUp successfully.' };
  }

  @Post('refresh')
  @Public()
  @ApiActionResponse({
    body: { message: 'refresh token successfully.' },
    operations: { description: '리프레시 토큰 재발급' }
  })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @ClientInfo() info: IClientInfoData) {
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
    if (!refreshToken) {
      throw new CustomException('INVALID_REFRESH_TOKEN');
    }

    const token = await this.authService.rotateRefreshToken(refreshToken, info.ip, info.userAgent);
    this.authService.setAuthCookies(res, token);
    return { message: 'refresh token successfully.' };
  }

  @Post('logout')
  @ApiActionResponse({
    body: { message: 'logout successfully.' },
    operations: { description: '로그아웃 성공 - 쿠키제거' }
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
    await this.authService.clearAuthCookies(res, refreshToken);
    return { message: 'logout successfully.' };
  }

  @Public()
  @Post('send-verification-email')
  @ApiActionResponse({
    operations: { description: '인증 이메일 발송' },
    body: { message: 'send-verification-email' }
  })
  @CheckBlacklist()
  async sendVerificationEmail(@Body() dto: SendVerificationEmailDto, @ClientInfo() { ip }: IClientInfoData) {
    await this.verifyEmailService.requestEmailVerification(dto.email, ip);
    return { message: 'send-verification-email' };
  }

  @Public()
  @Post('verify-email')
  @ApiActionResponse({
    operations: { description: '이메일 인증 성공' },
    body: { message: 'verify-email' }
  })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.verifyEmailService.verifyEmail(dto.email, dto.token);
    return { message: 'verify-email' };
  }

  async googleLogin() {}

  async googleLoginCallback() {}
}
