import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import type { Request, Response } from 'express';
import { CheckBlacklist, ClientInfo, Public } from '@/common/decorators';
import { RequestEmailVerificationDto, SignInDto, SignUpDto, VerifyEmailDto } from '@/modules/auth/dto';
import { VerificationService } from '@/modules/auth/verification.service';
import { AUTH_COOKIE } from '@/common/constants/auth';
import { CustomException } from '@/common/exceptions';
import { type IClientInfoData } from '@/common/decorators/client-info.decorator';
import { ApiActionResponse, headers } from '@/common/decorators/api-action-response.decorator';
import { ApiErrorResponses } from '@/common/decorators/api-error-response.decorator';
import { TokenService } from '@/modules/auth/token.service';
import { CookieService } from '@/modules/auth/cookie.service';
import { GoogleAuthGuard } from '@/modules/auth/guards/google-auth.guard';
import { ConfigService } from '@nestjs/config';
import { IAppConfig } from '@/config/config.interface';
import { ApiGetResponse } from '@/common/decorators/api-get-response.decorator';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verifyEmailService: VerificationService,
    private readonly tokenService: TokenService,
    private readonly cookieService: CookieService,
    private readonly configService: ConfigService
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiGetResponse({ operations: { summary: '구글 로그인' } })
  async googleAuth(): Promise<void> {
    console.log('call google auth page');
  }

  @Get('google/callback')
  @ApiGetResponse({ headers, operations: { summary: '구글 로그인 콜백' } })
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req, @Res() res: Response, @ClientInfo() info: IClientInfoData): Promise<void> {
    const token = await this.tokenService.generateTokenPair(req.user.id, {
      userAgent: info.userAgent,
      ipAddress: info.ip
    });

    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }

    this.cookieService.setTokenPair(res, token);
    const app: IAppConfig = await this.configService.getOrThrow('app');
    res.redirect(app.front);
  }

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

  //
  // @Post('sign-up')
  // @ApiActionResponse({
  //   body: { id: 'userId', message: 'sign up successfully.' },
  //   headers,
  //   operations: { summary: '회원가입', description: '회원가입 성공' }
  // })
  // @ApiErrorResponses(['EMAIL_ALREADY_EXISTS', 'VERIFICATION_INVALID'])
  // async signup(
  //   @Body() dto: SignUpDto,
  //   @Req() req: Request,
  //   @Res({ passthrough: true }) res: Response,
  //   @ClientInfo() info: IClientInfoData
  // ) {
  //   const { id } = await this.authService.signUp(dto);
  //   const token = await this.tokenService.generateTokenPair(id, {
  //     userAgent: info.userAgent,
  //     ipAddress: info.ip
  //   });
  //   const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
  //   if (refreshToken) {
  //     await this.tokenService.revokeRefreshToken(refreshToken);
  //   }
  //   this.cookieService.setTokenPair(res, token);
  //   return { id, message: 'sign up successfully.' };
  // }

  @Post('refresh')
  @ApiActionResponse({
    body: { message: 'Token refreshed.' },
    operations: { summary: 'Refresh Token 재발급' }
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
    operations: { summary: '로그아웃' }
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];

    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }

    this.cookieService.clearAuthCookies(res);
    return { message: 'Logged out' };
  }

  @Post('request-email-verification')
  @ApiActionResponse({
    operations: { description: '회원가입 인증 이메일 발송', summary: '로컬 회원가입 단계 1' },
    body: { message: 'Verification email sent' }
  })
  @CheckBlacklist()
  async requestEmailVerification(@Body() dto: RequestEmailVerificationDto, @ClientInfo() { ip }: IClientInfoData) {
    return this.verifyEmailService.requestEmailVerification(dto, ip);
  }

  @Post('verify-email')
  @ApiActionResponse({
    headers,
    operations: { description: '이메일 인증 성공 및 자동 로그인', summary: '로컬 회원가입 단계 2' },
    body: { message: 'Email verified' }
  })
  async verifyEmail(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: VerifyEmailDto,
    @ClientInfo() info: IClientInfoData
  ) {
    const { id } = await this.verifyEmailService.verifyEmail(dto.email, dto.token);
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
}
