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

  async createUser(data: UserCreateInput) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return this.db.user.create({
      data,
      select: { id: true, email: true }
    });
  }

  async getOrCreateUser(data: UserCreateInput) {
    const user = await this.db.user.findUnique({ where: { email: data.email } });
    if (user) {
      return user;
    }
    return this.db.user.create({ data });
  }
}
