import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import { subMinutes } from 'date-fns';
import { Inject, Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { RequestEmailVerificationDto } from '@/modules/auth/dto';
import { UsersService } from '@/modules/users/users.service';
import * as bcrypt from 'bcrypt';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { REDIS_CLIENT } from '@/modules/redis/redis.module';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { IAppConfig, IConfigKey } from '@/config/config.interface';

@Injectable()
export class VerificationService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly configService: ConfigService<IConfigKey>
  ) {}

  // Rate Limiting 설정
  private readonly MAX_ATTEMPTS_PER_5MIN = 5;
  private readonly TOKEN_EXPIRY_MINUTES = 30;

  async requestEmailVerification(data: RequestEmailVerificationDto, ip: string) {
    const { email, password } = data;

    // === Rate Limiting (가장 먼저) ===
    const rateLimitKey = `email-verify-rate:${email}`;
    const rateLimitExists = await this.redis.exists(rateLimitKey);

    if (rateLimitExists) {
      // 남은 시간 계산해서 알려주기
      const ttl = await this.redis.ttl(rateLimitKey);
      throw new CustomException('TOO_MANY_REQUESTS', { ttl });
    }

    const existingEmail = await this.userService.findByEmail(email);
    if (existingEmail) {
      throw new CustomException('EMAIL_ALREADY_EXISTS');
    }

    const existingKey = `email-verify:${email}`;
    const existingData = await this.redis.get(existingKey);

    let isResend = false;
    if (existingData) {
      isResend = true;
      // this.logger.log(`재발송 요청: ${email}`);
    }

    const hashing = await bcrypt.hash(password, 10);
    const token = randomStringGenerator();

    await this.redis.setex(
      `email-verify:${email}`,
      1800,
      JSON.stringify({
        token,
        email,
        ip,
        password: hashing,
        createdAt: Date.now()
      })
    );

    // 60초 동안 재요청 불가
    await this.redis.setex(rateLimitKey, 60, '1');

    const appConfig: IAppConfig = this.configService.getOrThrow('app');
    const verificationUrl = `${appConfig.front}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

    this.sendVerificationEmail(email, verificationUrl);

    return {
      message: isResend ? '인증 메일이 재발송되었습니다' : '인증 메일이 발송되었습니다'
    };
  }

  async verifyEmail(email: string, token: string) {
    const key = `email-verify:${email}`;
    const data = await this.redis.get(key);

    if (!data) {
      throw new CustomException('VERIFICATION_INVALID');
    }

    const verifyData = JSON.parse(data);

    if (token !== verifyData.token) {
      throw new CustomException('VERIFICATION_INVALID');
    }
    const end = Math.floor(Math.random() * (10000 - 100 + 1)) + 100;
    const user = await this.prisma.user.create({
      data: {
        email: verifyData.email,
        password: verifyData.password, // 이미 해싱된 상태
        username: verifyData.email.split('@')[0] + end.toString(),
        emailVerified: true
      },
      select: {
        id: true
      }
    });

    // 4. Redis 키 삭제
    await this.redis.del(key);

    return { id: user.id };
  }

  private async checkRateLimit(ip: string) {
    const fiveMinuteAgo = subMinutes(new Date(), 5);

    // 5분 내 같은 IP에서 발송한 횟수
    // const count = await this.db.verification.count({
    //   where: {
    //     ip,
    //     type: 'EMAIL_VERIFICATION',
    //     createdAt: { gte: fiveMinuteAgo }
    //   }
    // });
    //
    // // 5분 내 10번 초과
    // if (count >= this.MAX_ATTEMPTS_PER_5MIN) {
    //   throw new CustomException('TOO_MANY_REQUESTS');
    // }
  }

  sendVerificationEmail(email: string, token: string) {
    // TODO: 실제 이메일 서비스 (SendGrid, AWS SES 등) 연동
    console.log(`[Email] To: ${email}, Token: ${token}`);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'wodus331@gmail.com',
        pass: 'mgorcdpaagbjaeci'
      }
    });

    transporter
      .sendMail({
        from: 'wodus331@gmail.com',
        to: email,
        subject: '이메일 인증',
        html: `
    <p>아래 버튼을 클릭해 이메일 인증을 완료해주세요.</p>
    <p>
      <a href="${token}"
         style="display:inline-block;padding:10px 16px;
                background:#2563eb;color:#fff;
                text-decoration:none;border-radius:6px;">
        이메일 인증하기
      </a>
    </p>
    <p>이 링크는 일정 시간 후 만료됩니다.</p>
  `
      })
      .then((r) => console.log(r.response));
  }
}
