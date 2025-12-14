import { IsEmail, IsString, MinLength } from 'class-validator';

export class RequestEmailVerificationDto {
  /** 이메일 @example "user@example.com"*/
  @IsEmail()
  email: string;
  /** 비밀번호 @example "1234"*/
  @IsString()
  @MinLength(4)
  password: string;
}

export class VerifyEmailDto {
  /** 이메일 @example  "user@example.com" */
  @IsEmail()
  email: string;

  /** 인증코드 @example  "tedsa"*/
  @IsString()
  token: string;
}
