import { Injectable } from '@nestjs/common';
import { User } from '@generated/prisma/client';

@Injectable()
export class UsersService {
  private readonly users = [];

  async findOne(username: string): Promise<User | undefined> {
    return undefined;
  }
}
