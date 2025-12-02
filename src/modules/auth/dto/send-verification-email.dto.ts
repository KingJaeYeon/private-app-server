import { IsEmail } from 'class-validator';

export class SendVerificationEmailDto {
  @IsEmail()
  email: string;
}

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  token: string;
}
