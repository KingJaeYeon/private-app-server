import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';
import { User } from '@generated/prisma/client';
import { CustomException } from '@/common/exceptions';

@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaService) {}

  async getUserByUserId(userId: string): Promise<User> {
    const user = await this.db.user.findUnique({
      where: { id: userId }
    });
    if (!user) {
      throw new CustomException('USER_NOT_FOUND');
    }
    return user;
  }
}
