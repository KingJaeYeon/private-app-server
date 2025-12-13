import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { User } from '@generated/prisma/client';
import { CustomException } from '@/common/exceptions';
import { UserCreateInput, UserWhereInput, UserWhereUniqueInput } from '@generated/prisma/models/User';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaService) {}

  async getUser(query: UserWhereUniqueInput | { identifier: string }): Promise<User> {
    let user: User | null = null;

    if ('identifier' in query) {
      user = await this.db.user.findFirst({
        where: {
          OR: [{ email: query.identifier }, { username: query.identifier }]
        }
      });
    } else {
      user = await this.db.user.findUnique({ where: query });
    }

    if (!user) {
      throw new CustomException('USER_NOT_FOUND');
    }

    return user;
  }

  async getUsers(query: UserWhereInput): Promise<User[]> {
    return this.db.user.findMany({ where: query });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  async createUser(data: UserCreateInput) {
    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : null;

    return this.db.user.create({
      data: {
        ...data,
        password: hashedPassword
      }
    });
  }

  // TODO: OAuth 할 때 수정필요
  async getOrCreateUser(data: UserCreateInput) {
    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : null;

    return this.db.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        ...data,
        password: hashedPassword
      }
    });
  }

  async getUserState(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        username: true,
        emailVerified: true,
        email: true,
        profileIcon: true,
        account: {
          where: {
            deletedAt: null
          },
          select: {
            provider: true
          }
        }
      }
    });

    if (!user) {
      throw new CustomException('USER_NOT_FOUND');
    }

    const { account, ...other } = user;
    let oAuthType = 'LOCAL';

    if (account.length > 0) {
      oAuthType = account[0].provider;
    }

    return {
      ...other,
      oAuthType
    };
  }
}
