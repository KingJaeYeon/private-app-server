import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { CustomException } from '@/common/exceptions';
import * as bcrypt from 'bcrypt';
import { User } from '@generated/prisma/client';
import { SignUpDto } from '@/modules/auth/dto';
import { UsersService } from '@/modules/users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly db: PrismaService
  ) {}

  async validateUser(identifier: string, password: string): Promise<User> {
    const user = await this.usersService.getUser({ identifier });

    // OAuth User
    if (user.password === null) {
      throw new CustomException('INVALID_CREDENTIALS');
    }

    // TODO: 사용자 상태 검증 ( 휴먼계정, 블랙리스트 등등)
    // TODO: Email 인증 여부

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new CustomException('INVALID_CREDENTIALS');
    }

    return user;
  }

  async signUp(dto: SignUpDto) {
    const exists = await this.usersService.findByEmail(dto.email);
    if (exists) {
      throw new CustomException('EMAIL_ALREADY_EXISTS');
    }

    const validCode = await this.db.verification.findFirst({
      where: {
        email: dto.email,
        type: 'EMAIL_VERIFICATION',
        expiredAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!validCode) {
      throw new CustomException('VERIFICATION_INVALID');
    }

    if (validCode.token !== dto.verifyCode) {
      throw new CustomException('VERIFICATION_INVALID');
    }

    return this.usersService.createUser({
      email: dto.email,
      password: dto.password,
      username: dto.email.split('@')[0],
      emailVerified: new Date()
    });
  }
}
