import { IsEmail } from 'class-validator';

export class SendVerificationEmailDto {
  /** 이메일 @example  "user@example.com"*/
  @IsEmail()
  email: string;
}

export class VerifyEmailDto {
  /** 이메일 @example  "user@example.com" */
  @IsEmail()
  email: string;
  /** 인증코드 @example  "tedsa"*/
  token: string;
}
