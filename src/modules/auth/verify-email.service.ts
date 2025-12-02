import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { getRandomString } from '@/common/util/util';
import { addMinutes, subMinutes } from 'date-fns';
import { VerificationType } from '@generated/prisma/enums';

export class VerifyEmailService {
  constructor(private readonly db: PrismaService) {}
  // Rate Limiting 설정
  private readonly MAX_ATTEMPTS_PER_10_MIN = 10; // 5분에 5번
  private readonly MAX_ATTEMPTS_BEFORE_BLOCK = 20; // 누적 20번 시도 시 블랙리스트
  private readonly BLACKLIST_DURATION_HOURS = 24; // 24시간 차단
  private readonly TOKEN_EXPIRY_MINUTES = 30; // 토큰 유효기간 30분

  async requestEmailVerification(email: string, ip: string) {
    // 1. 이미 인증하고 가입한 유저인지 체크
    const existingUser = await this.db.user.findUnique({
      where: { email }
    });

    if (existingUser?.emailVerified) {
      throw new CustomException('EMAIL_ALREADY_EXISTS');
    }

    // 2. IP 기반 Rate Limiting 체크
    await this.validateEmailVerificationRate(ip);

    // 3. 새 인증 토큰 생성
    const token = getRandomString();
    const expiredAt = addMinutes(new Date(), this.TOKEN_EXPIRY_MINUTES);

    await this.db.verification.create({
      data: {
        type: VerificationType.EMAIL_VERIFICATION,
        email,
        ip,
        token,
        expiredAt
      }
    });

    // 5. 이메일 발송 (실제로는 이메일 서비스 호출)
    this.sendEmail(email, token);

    return {
      message: '인증 이메일이 발송되었습니다',
      expiresIn: `${this.TOKEN_EXPIRY_MINUTES}분`
    };
  }

  async verifyEmail(email: string, token: string) {
    // 1. 인증 토큰 조회
    const verification = await this.db.verification.findUnique({
      where: {
        type_email_token: {
          type: VerificationType.EMAIL_VERIFICATION,
          email,
          token
        }
      }
    });

    if (!verification) {
      throw new CustomException('VERIFICATION_INVALID');
    }

    // 2. 만료 확인
    if (verification.expiredAt < new Date()) {
      throw new CustomException('VERIFICATION_EXPIRED');
    }

    return {
      message: 'verify email success'
    };
  }

  private async validateEmailVerificationRate(ip: string) {
    const fiveMinuteAgo = subMinutes(new Date(), 5);

    // 5분 내 같은 IP에서 발송한 횟수
    const recentAttempts = await this.db.verification.count({
      where: {
        ip,
        type: VerificationType.EMAIL_VERIFICATION,
        createdAt: { gte: fiveMinuteAgo }
      }
    });

    // 5분 내 10번 초과
    if (recentAttempts >= this.MAX_ATTEMPTS_PER_10_MIN) {
      throw new CustomException('TO_MANY_REQUEST');
    }

    // 전체 누적 시도 횟수 (블랙리스트 체크용)
    const totalAttempts = await this.db.verification.count({
      where: {
        ip,
        type: VerificationType.EMAIL_VERIFICATION
      }
    });

    // 누적 20번 이상 시도 시 블랙리스트 추가
    if (totalAttempts >= this.MAX_ATTEMPTS_BEFORE_BLOCK) {
      await this.addToBlacklist(ip, `과도한 인증 메일 요청 (${totalAttempts}회)`);
      throw new CustomException('TO_MANY_REQUEST_BLOCK');
    }
  }

  /**
   * IP를 블랙리스트에 추가
   */
  private async addToBlacklist(ip: string, reason: string) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.BLACKLIST_DURATION_HOURS);

    await this.db.blacklist.create({
      data: {
        ip,
        reason,
        expiresAt
      }
    });
  }

  sendEmail(email: string, token: string) {
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
