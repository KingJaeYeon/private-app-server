import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import type { Request, Response } from 'express';
import { CheckBlacklist, ClientInfo, Public } from '@/common/decorators';
import { SendVerificationEmailDto, SignInDto, SignUpDto, VerifyEmailDto } from '@/modules/auth/dto';
import { VerificationService } from '@/modules/auth/verification.service';
import { AUTH_COOKIE } from '@/common/constants/auth';
import { CustomException } from '@/common/exceptions';
import { type IClientInfoData } from '@/common/decorators/client-info.decorator';
import { ApiActionResponse, headers } from '@/common/decorators/api-action-response.decorator';
import { ApiErrorResponses } from '@/common/decorators/api-error-response.decorator';
import { TokenService } from '@/modules/auth/token.service';
import { CookieService } from '@/modules/auth/cookie.service';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verifyEmailService: VerificationService,
    private readonly tokenService: TokenService,
    private readonly cookieService: CookieService
  ) {}

  @ApiActionResponse({
    body: { id: 'userId', message: 'sign In successfully.' },
    headers,
    operations: {
      summary: '로그인',
      description: ' **Access Token**과 **Refresh Token** 쿠키가 응답 헤더에 설정됩니다'
    }
  })
  @ApiErrorResponses(['INVALID_CREDENTIALS'])
  @Post('sign-in')
  async signIn(
    @Body() dto: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @ClientInfo() info: IClientInfoData
  ) {
    const { id } = await this.authService.validateUser(dto.identifier, dto.password);
    const token = await this.tokenService.generateTokenPair(id, {
      userAgent: info.userAgent,
      ipAddress: info.ip
    });
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }
    this.cookieService.setTokenPair(res, token);
    return { id, message: 'sign In successfully.' };
  }

  @Post('sign-up')
  @ApiActionResponse({
    body: { id: 'userId', message: 'sign up successfully.' },
    headers,
    operations: { summary: '회원가입', description: '회원가입 성공' }
  })
  @ApiErrorResponses(['EMAIL_ALREADY_EXISTS', 'VERIFICATION_INVALID'])
  async signup(
    @Body() dto: SignUpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @ClientInfo() info: IClientInfoData
  ) {
    const { id } = await this.authService.signUp(dto);
    const token = await this.tokenService.generateTokenPair(id, {
      userAgent: info.userAgent,
      ipAddress: info.ip
    });
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }
    this.cookieService.setTokenPair(res, token);
    return { id, message: 'sign up successfully.' };
  }

  @Post('refresh')
  @ApiActionResponse({
    body: { message: 'Token refreshed.' },
    operations: { description: '리프레시 토큰 재발급' }
  })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @ClientInfo() info: IClientInfoData) {
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
    if (!refreshToken) {
      throw new CustomException('INVALID_REFRESH_TOKEN');
    }

    const token = await this.tokenService.rotateRefreshToken(refreshToken, {
      userAgent: info.userAgent,
      ipAddress: info.ip
    });
    this.cookieService.setTokenPair(res, token);
    return { id: token.userId, message: 'Token refreshed.' };
  }

  @Post('logout')
  @ApiActionResponse({
    body: { message: 'Logged out' },
    operations: { description: '로그아웃 성공 - 쿠키제거' }
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];

    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }

    this.cookieService.clearAuthCookies(res);
    return { message: 'Logged out' };
  }

  @Post('send-verification-email')
  @ApiActionResponse({
    operations: { description: '인증 이메일 발송' },
    body: { message: 'Verification email sent' }
  })
  @CheckBlacklist()
  async sendVerificationEmail(@Body() dto: SendVerificationEmailDto, @ClientInfo() { ip }: IClientInfoData) {
    await this.verifyEmailService.requestEmailVerification(dto.email, ip);
    return { message: 'Verification email sent' };
  }

  @Post('verify-email')
  @ApiActionResponse({
    operations: { description: '이메일 인증 성공' },
    body: { message: 'Email verified' }
  })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.verifyEmailService.verifyEmailCode(dto.email, dto.token);
    return { message: 'Email verified' };
  }

  async googleLogin() {}

  async googleLoginCallback() {}
}
