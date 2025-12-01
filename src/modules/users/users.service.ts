import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaService) {}
}
