import { User } from '@generated/prisma/client';
import { Expose } from 'class-transformer';

export class UserResponseDto implements Partial<User> {
  @Expose()
  id: string;
  @Expose()
  email: string;
  @Expose()
  emailVerified: Date;
  @Expose()
  username: string;
  @Expose()
  bio: string;
  @Expose()
  profileIcon: string;
  @Expose()
  createdAt: Date;
  @Expose()
  oAuthType: string;
}
