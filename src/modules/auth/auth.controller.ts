import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import type { Request, Response } from 'express';
import { CheckBlacklist, ClientInfo, Public } from '@/common/decorators';
import { SendVerificationEmailDto, SignInDto, SignUpDto, VerifyEmailDto } from '@/modules/auth/dto';
import { VerifyEmailService } from '@/modules/auth/verify-email.service';
import { AUTH_COOKIE } from '@/common/constants/auth';
import { CustomException } from '@/common/exceptions';
import { type IClientInfoData } from '@/common/decorators/client-info.decorator';
import { ApiActionResponse } from '@/common/decorators/api-action-response.decorator';
import { ApiErrorResponses } from '@/common/decorators/api-error-response.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verifyEmailService: VerifyEmailService
  ) {}

  @Public()
  @ApiActionResponse({
    id: 'userId',
    message: 'signIn successfully.',
    description: '로그인 성공. **Access Token**과 **Refresh Token** 쿠키가 응답 헤더에 설정됩니다.',
    headers: {
      'Set-Cookie-Access-Token': {
        description: '인증에 사용되는 Access Token (HttpOnly, 짧은 만료 시간)',
        schema: {
          type: 'string',
          example: 'access_token=jwt.access.token; HttpOnly; Secure; Path=/'
        }
      },
      'Set-Cookie-Refresh-Token': {
        description: '토큰 갱신에 사용되는 Refresh Token (HttpOnly)',
        schema: {
          type: 'string',
          example: 'refresh_token=jwt.refresh.token; HttpOnly; Secure; Path=/auth'
        }
      }
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
    id: 'userId',
    message: 'signUp successfully.',
    description: '회원가입 성공',
    headers: {
      'Set-Cookie-Access-Token': {
        description: '인증에 사용되는 Access Token (HttpOnly, 짧은 만료 시간)',
        schema: {
          type: 'string',
          example: 'access_token=jwt.access.token; HttpOnly; Secure; Path=/'
        }
      },
      'Set-Cookie-Refresh-Token': {
        description: '토큰 갱신에 사용되는 Refresh Token (HttpOnly)',
        schema: {
          type: 'string',
          example: 'refresh_token=jwt.refresh.token; HttpOnly; Secure; Path=/auth'
        }
      }
    }
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
  @ApiActionResponse({
    description: '리프레시 토큰 재발급',
    message: 'refresh token successfully.'
  })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @ClientInfo() info: IClientInfoData) {
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
    if (!refreshToken) {
      throw new CustomException('FORBIDDEN');
    }

    const token = await this.authService.rotateRefreshToken(refreshToken, info.ip, info.userAgent);
    this.authService.setAuthCookies(res, token);
    return { message: 'refresh token successfully.' };
  }

  @Post('logout')
  @ApiActionResponse({
    description: '로그아웃 성공 - 쿠키제거',
    message: 'logout successfully.'
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies[AUTH_COOKIE.REFRESH];
    await this.authService.clearAuthCookies(res, refreshToken);
    return { message: 'logout successfully.' };
  }

  @Public()
  @Post('send-verification-email')
  @ApiActionResponse({ description: '인증 이메일 발송' })
  @CheckBlacklist()
  async sendVerificationEmail(@Body() dto: SendVerificationEmailDto, @ClientInfo() { ip }: IClientInfoData) {
    await this.verifyEmailService.requestEmailVerification(dto.email, ip);
  }

  @Public()
  @Post('verify-email')
  @ApiActionResponse({ description: '이메일 인증 성공' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.verifyEmailService.verifyEmail(dto.email, dto.token);
  }
}
