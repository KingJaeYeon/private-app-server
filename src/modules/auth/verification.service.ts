import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { addMinutes, subMinutes } from 'date-fns';
import { VerificationType } from '@generated/prisma/enums';
import { Injectable } from '@nestjs/common';
import crypto from 'crypto';

@Injectable()
export class VerificationService {
  constructor(private readonly db: PrismaService) {}
  // Rate Limiting 설정
  private readonly MAX_ATTEMPTS_PER_5MIN = 5;
  private readonly TOKEN_EXPIRY_MINUTES = 30;

  async requestEmailVerification(email: string, ip: string) {
    // 1. 이미 인증하고 가입한 유저인지 체크
    const user = await this.db.user.findUnique({ where: { email } });
    if (user?.emailVerified) {
      throw new CustomException('EMAIL_ALREADY_EXISTS');
    }

    // 2. IP 기반 Rate Limiting 체크
    await this.checkRateLimit(ip);

    // 3. 새 인증 토큰 생성
    const token = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expiredAt = addMinutes(new Date(), this.TOKEN_EXPIRY_MINUTES);

    await this.db.verification.create({
      data: {
        type: 'EMAIL_VERIFICATION',
        email,
        ip,
        token,
        expiredAt
      }
    });

    this.sendVerificationEmail(email, token);
  }

  async verifyEmailCode(email: string, code: string) {
    // 1. 인증 토큰 조회
    const verification = await this.db.verification.findFirst({
      where: {
        email,
        token: code,
        type: 'EMAIL_VERIFICATION',
        expiredAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!verification) {
      throw new CustomException('VERIFICATION_INVALID');
    }
  }

  private async checkRateLimit(ip: string) {
    const fiveMinuteAgo = subMinutes(new Date(), 5);

    // 5분 내 같은 IP에서 발송한 횟수
    const count = await this.db.verification.count({
      where: {
        ip,
        type: 'EMAIL_VERIFICATION',
        createdAt: { gte: fiveMinuteAgo }
      }
    });

    // 5분 내 10번 초과
    if (count >= this.MAX_ATTEMPTS_PER_5MIN) {
      throw new CustomException('TOO_MANY_REQUESTS');
    }
  }

  sendVerificationEmail(email: string, token: string) {
    // TODO: 실제 이메일 서비스 (SendGrid, AWS SES 등) 연동
    console.log(`[Email] To: ${email}, Token: ${token}`);

    // 예시: Nodemailer
    // await this.mailerService.sendMail({
    //   to: email,
    //   subject: '이메일 인증',
    //   html: `인증 코드: <strong>${token}</strong>`,
    // });
  }
}
